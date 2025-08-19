import { NextResponse, type NextRequest } from "next/server";

interface GenerateImageRequest {
  rawPrompt: string;
  source?: "custom" | "suggestion";
}

/* 
  Use a constant to avoid magic strings for header names
*/
const X_FINGERPRINT_HEADER = "X-Fingerprint";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  if (!process.env.FUNCTION_APP_URL) {
    console.error("FATAL: FUNCTION_APP_URL environment variable is not set");

    return NextResponse.json(
      { error: "Server is misconfigured. Please contact the developer." },
      { status: 500 },
    );
  }

  let requestData: GenerateImageRequest;

  try {
    requestData = await request.json();
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid JSON in request body." },
      { status: 400 },
    );
  }

  const fingerprint =
    request.headers.get(X_FINGERPRINT_HEADER) ?? request.ip ?? "127.0.0.1";

  try {
    const azureFunctionUrl = `${process.env.FUNCTION_APP_URL}/api/create-image`;

    const response = await fetch(azureFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        [X_FINGERPRINT_HEADER]: fingerprint,
      },
      body: JSON.stringify(requestData),
      cache: "no-store",
    });

    const jsonResponse = await response.json();
    return NextResponse.json(jsonResponse, { status: response.status });
  } catch (error) {
    console.error("Error calling the generate image API:", error);

    return NextResponse.json(
      {
        error: (error as Error).message || "An internal server error occurred.",
      },
      { status: 500 },
    );
  }
}
