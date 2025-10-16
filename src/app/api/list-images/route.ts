import { NextResponse, type NextRequest } from "next/server";

/* 
  Use a constant to avoid magic strings for header names
*/
const X_FINGERPRINT_HEADER = "X-Fingerprint";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  if (!process.env.FUNCTION_APP_URL) {
    console.error("FATAL: FUNCTION_APP_URL environment variable is not set");

    return NextResponse.json(
      { error: "Server is misconfigured. Please contact the developer." },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(request.url);

  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "9", 10);

  if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1) {
    return NextResponse.json(
      {
        error: "Query parameters 'page' and 'limit' must be positive integers.",
      },
      { status: 400 },
    );
  }

  const fingerprint =
    request.headers.get(X_FINGERPRINT_HEADER) ?? request.ip ?? "127.0.0.1";

  try {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    const azureFunctionUrl = `${
      process.env.FUNCTION_APP_URL
    }/api/list-images?${params.toString()}`;

    const response = await fetch(azureFunctionUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        [X_FINGERPRINT_HEADER]: fingerprint,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: `API returned with status: ${response.status}`,
      }));

      throw new Error(
        errorData.error || "Failed to fetch data from the upstream API",
      );
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching images from Azure Function:", error);

    return NextResponse.json(
      {
        error: (error as Error).message || "An internal server error occurred.",
      },
      { status: 500 },
    );
  }
}
