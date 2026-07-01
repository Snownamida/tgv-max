/** Application-wide constants (endpoints, external links). */

/** OpenDataSoft dataset endpoint for the SNCF « tgvmax » dataset. */
export const TGVMAX_DATASET =
  "https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets/tgvmax";

/** Public dataset page (shown in the footer). */
export const TGVMAX_DATASET_PAGE = "https://ressources.data.sncf.com/explore/dataset/tgvmax/";

/** SNCF Connect search page (best-effort booking deep link). */
export const SNCF_CONNECT_SEARCH = "https://www.sncf-connect.com/app/home/search";

/** Simplified rail-network GeoJSON, served from `public/`. */
export const RAILNET_URL = `${import.meta.env.BASE_URL}railnet.geojson`;
