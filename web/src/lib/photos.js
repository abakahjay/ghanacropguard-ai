// Photos used around the site (Wikimedia Commons, re-encoded to WebP with metadata removed).
// Each one is credited where it is shown; keep author, licence and source with the file.
export const photos = {
  "cassava": {
    "src": "/photos/cassava-1600.webp",
    "srcSmall": "/photos/cassava-800.webp",
    "width": 1600,
    "height": 2133,
    "alt": "Cassava plants on a farm in Ghana",
    "author": "Manafpixil",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Ghananian_Cassava_plant.jpg"
  },
  "maize": {
    "src": "/photos/maize-1600.webp",
    "srcSmall": "/photos/maize-800.webp",
    "width": 1600,
    "height": 1060,
    "alt": "A maize farm in Northern Ghana",
    "author": "Ibn Shiraz",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Maize_Farm_in_Northern_Ghana.jpg"
  },
  "tomato": {
    "src": "/photos/tomato-1600.webp",
    "srcSmall": "/photos/tomato-800.webp",
    "width": 1600,
    "height": 1060,
    "alt": "Fresh tomatoes at a market in Tamale, Ghana",
    "author": "Ibn Shiraz",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Tomatoes_in_the_Market,_Tamale_Ghana.jpg"
  },
  "cashew": {
    "src": "/photos/cashew-1600.webp",
    "srcSmall": "/photos/cashew-800.webp",
    "width": 1600,
    "height": 1071,
    "alt": "Ripe cashew apples with their nuts on the tree",
    "author": "Ben Tavener",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Cashew_apple_with_nut_-_Caju.jpg"
  },
  "farmers": {
    "src": "/photos/farmers-1600.webp",
    "srcSmall": "/photos/farmers-800.webp",
    "width": 1600,
    "height": 1067,
    "alt": "Members of the Rural Women Farmers Association of Ghana preparing a field",
    "author": "Global Justice Now",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
    "source": "https://commons.wikimedia.org/wiki/File:Rural_Women%27s_Farmers_Association_of_Ghana_prepping_a_field.jpg"
  },
  "harvest": {
    "src": "/photos/harvest-1600.webp",
    "srcSmall": "/photos/harvest-800.webp",
    "width": 1600,
    "height": 1067,
    "alt": "A farmer harvesting maize in Ghana",
    "author": "Wilhelm Nomu Kutah",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "source": "https://commons.wikimedia.org/wiki/File:Harvest_2.jpg"
  }
};

export const credit = (p) => `Photo: ${p.author}, ${p.license}, via Wikimedia Commons`;
