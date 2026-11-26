/** Photos from Wikimedia Commons, used under their Creative Commons licences (credited in the footer). */
export const PHOTOS = {
  shgMeeting: {
    src: "/images/shg-meeting.jpg", w: 1280, h: 960,
    alt: "Women's self-help group meeting under a village community hall in Cuddalore district, Tamil Nadu",
    caption: "Self-help group meeting, Cuddalore",
    author: "Pondicherry17", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    source: "https://commons.wikimedia.org/wiki/File:Women_self_help_group_foundation.jpg",
  },
  farmer: {
    src: "/images/farmer-paddy.jpg", w: 1280, h: 960,
    alt: "Farmer with two bullocks preparing a flooded paddy field near Madurai",
    caption: "Preparing a paddy field near Madurai",
    author: "எஸ்ஸார் (Essar)", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    source: "https://commons.wikimedia.org/wiki/File:A_agricultural_worker_works_with_Parambu_to_prepare_the_field_for_Paddy_plantation.jpg",
  },
  vendor: {
    src: "/images/vendor-chengalpattu.jpg", w: 1280, h: 1920,
    alt: "Vegetable vendor sitting among tomatoes, carrots, beans and brinjal at Chengalpattu market",
    caption: "Vegetable vendor, Chengalpattu market",
    author: "Vinoth Chandar", license: "CC BY 2.0", licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
    source: "https://commons.wikimedia.org/wiki/File:A_Vegetable_Vendor_at_Chengalpet_Market_-_Happy_Madras_Week!!!_(14801208708).jpg",
  },
  shgStall: {
    src: "/images/shg-selling.jpg", w: 1280, h: 849,
    alt: "Members of a women's self-help group selling pickles, snacks and textiles at a stall with Tamil banners",
    caption: "Women's self-help group stall",
    author: "Gavaskar.tk", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    source: "https://commons.wikimedia.org/wiki/File:Self_help_group_selling_goods.JPG",
  },
} as const;

export type PhotoKey = keyof typeof PHOTOS;
