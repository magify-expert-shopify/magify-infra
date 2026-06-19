export type BlogResult = {
  id: string;
  name: string | null;
  title: string | null;
  baseUrl: string;
  competitorAgencySite: {
    name: string;
  };
};
