export type Image = {
  name: string;
  url: string;
  availableSizes?: Array<{
    filename: string;
    suffix: string;
    url: string;
  }>;
  timestamp?: number;
};

export type ImagesData = {
  images: Image[];
  pagination: PaginationData;
};
