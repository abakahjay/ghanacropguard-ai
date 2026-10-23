import { useEffect, useState } from "react";

import { api } from "./client";

// Public content from the API, fetched once per page load and shared between pages.
const cache = new Map();
function load(path, pick = (x) => x) {
  if (!cache.has(path)) {
    cache.set(
      path,
      api(path)
        .then(pick)
        .catch(() => {
          cache.delete(path); // retry on the next visit
          return null;
        }),
    );
  }
  return cache.get(path);
}

/** { data, loading } where data is null if it could not be loaded. */
function useResource(path, pick) {
  const [state, setState] = useState({ data: undefined, loading: true });
  useEffect(() => {
    let live = true;
    load(path, pick).then((data) => live && setState({ data, loading: false }));
    return () => {
      live = false;
    };
  }, [path, pick]);
  return state;
}

const pickCrops = (r) => r.crops;
export const useCrops = () => useResource("/crops", pickCrops);
export const useModelInfo = () => useResource("/model/info");

export const CROP_INTRO = {
  cashew: { name: "Cashew", line: "A major export tree crop in Ghana's Bono, Bono East and Northern belts." },
  cassava: { name: "Cassava", line: "A staple grown in almost every region, eaten as gari, fufu and kokonte." },
  maize: { name: "Maize", line: "Ghana's most widely grown cereal, planted in both the major and minor seasons." },
  tomato: { name: "Tomato", line: "A high-value vegetable for local markets, grown under irrigation and rain." },
};
