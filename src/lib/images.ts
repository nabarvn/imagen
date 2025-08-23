import type { ImagesData } from "@/typings";

const X_FINGERPRINT_HEADER = "X-Fingerprint";

const getImages = async (
  fingerprint?: string | null,
  page: number = 1,
  limit: number = 9,
): Promise<ImagesData> => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  const apiUrl = `/api/list-images?${params.toString()}`;

  const headers: HeadersInit = {
    Accept: "application/json",
    Priority: page === 1 ? "high" : "low",
  };

  if (fingerprint) {
    headers[X_FINGERPRINT_HEADER] = fingerprint;
  }

  try {
    const response = await fetch(apiUrl, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      const message =
        errorData.error || `Request failed with status ${response.status}`;

      throw new Error(message);
    }

    const data = (await response.json()) as ImagesData;

    return data;
  } catch (error) {
    console.error("Error fetching images:", error);
    throw error;
  }
};

export default getImages;
