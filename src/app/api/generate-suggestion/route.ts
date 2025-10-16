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

  const fingerprint =
    request.headers.get(X_FINGERPRINT_HEADER) ?? request.ip ?? "127.0.0.1";

  try {
    const azureFunctionUrl = `${process.env.FUNCTION_APP_URL}/api/generate-suggestion`;

    const response = await fetch(azureFunctionUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        [X_FINGERPRINT_HEADER]: fingerprint,
      },
      cache: "no-store",
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error(
      "Error fetching prompt suggestion from Azure Function:",
      error,
    );

    return NextResponse.json(
      {
        error: (error as Error).message || "An internal server error occurred.",
      },
      { status: 500 },
    );
  }
}
