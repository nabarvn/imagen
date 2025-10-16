const X_FINGERPRINT_HEADER = "X-Fingerprint";

const getPromptSuggestion = async (
  fingerprint?: string | null,
): Promise<string> => {
  const headers: HeadersInit = {
    Accept: "application/json",
  };

  if (fingerprint) {
    headers[X_FINGERPRINT_HEADER] = fingerprint;
  }

  try {
    const response = await fetch("/api/generate-suggestion", {
      method: "GET",
      headers,
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      const message =
        data.error || `Request failed with status ${response.status}`;

      throw new Error(message);
    }

    if (typeof data.suggestion !== "string") {
      throw new Error("Invalid response format from API. Expected a string.");
    }

    return data.suggestion;
  } catch (error) {
    console.error("Error fetching prompt suggestion:", error);
    throw error;
  }
};

export default getPromptSuggestion;
