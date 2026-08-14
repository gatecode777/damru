import { API_URL } from "../config";
import { ImageSourcePropType } from "react-native";

export const getWebImageUri = (path: string) => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return encodeURI(path);
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = API_URL && !API_URL.includes("localhost") && !API_URL.includes("10.0.2.2")
    ? API_URL
    : "https://damrurestro.com";
  return encodeURI(`${baseUrl}${cleanPath}`);
};

export const LocalAssets = {
  logo: require("../../assets/images/damru.webp") as ImageSourcePropType,
  leafA: require("../../assets/images/Leafa.webp") as ImageSourcePropType,
  leafB: require("../../assets/images/Leafb.webp") as ImageSourcePropType,
  plates: [
    require("../../assets/images/plate1.webp") as ImageSourcePropType,
    require("../../assets/images/plate2.webp") as ImageSourcePropType,
    require("../../assets/images/plate3.webp") as ImageSourcePropType,
    require("../../assets/images/plate4.webp") as ImageSourcePropType,
  ],
  categories: {
    southIndian: require("../../assets/images/c1.webp") as ImageSourcePropType,
    northIndian: require("../../assets/images/c2.webp") as ImageSourcePropType,
    desserts: require("../../assets/images/c3.webp") as ImageSourcePropType,
  },
  drink: require("../../assets/images/drink.webp") as ImageSourcePropType,
  soup: require("../../assets/images/soup.webp") as ImageSourcePropType,
  chef: require("../../assets/images/Excelentcook.webp") as ImageSourcePropType,
  chef2: require("../../assets/images/chef2.webp") as ImageSourcePropType,
  dietPlan1: require("../../assets/images/dietplan1.webp") as ImageSourcePropType,
  dietPlan2: require("../../assets/images/dietplan2.webp") as ImageSourcePropType,
  menuleaf: require("../../assets/images/menuleaf.webp") as ImageSourcePropType,
  shakes: [
    require("../../assets/images/menu1.webp") as ImageSourcePropType,
    require("../../assets/images/menu2.webp") as ImageSourcePropType,
    require("../../assets/images/menu3.webp") as ImageSourcePropType,
    require("../../assets/images/menu4.webp") as ImageSourcePropType,
  ],
  banquetSlides: [
    require("../../assets/images/banquet/slide1.webp") as ImageSourcePropType,
    require("../../assets/images/banquet/slide2.webp") as ImageSourcePropType,
    require("../../assets/images/banquet/slide3.webp") as ImageSourcePropType,
    require("../../assets/images/banquet/slide4.webp") as ImageSourcePropType,
  ],
  mains: require("../../assets/images/mains.webp") as ImageSourcePropType,
  soups: require("../../assets/images/soups.webp") as ImageSourcePropType,
  soupMenuHero: require("../../assets/images/soupmenu.webp") as ImageSourcePropType,
  contact1: require("../../assets/images/contact1.webp") as ImageSourcePropType,
  contact2: require("../../assets/images/contact2.webp") as ImageSourcePropType,
  contactHeroBg: require("../../assets/images/contact_hero_bg.webp") as ImageSourcePropType,
  aboutHeroBg: require("../../assets/images/aboutus.webp") as ImageSourcePropType,
  ourStoryImg: require("../../assets/images/ourstory.webp") as ImageSourcePropType,
  abtusFlower: require("../../assets/images/abtusflower.webp") as ImageSourcePropType,
  founderPhoto: require("../../assets/images/raja.webp") as ImageSourcePropType,
  chefPhoto: require("../../assets/images/sandeep.webp") as ImageSourcePropType,
  deliciousBg: require("../../assets/images/deliciouus.webp") as ImageSourcePropType,
  sliceImg: require("../../assets/images/slice.webp") as ImageSourcePropType,
  marinatedImg: require("../../assets/images/marinated.webp") as ImageSourcePropType,
  bakeImg: require("../../assets/images/bake.webp") as ImageSourcePropType,
  rosemary: require("../../assets/images/rosemary.webp") as ImageSourcePropType,
  rosemary1: require("../../assets/images/rosemary1.webp") as ImageSourcePropType,
  upiQr: require("../../assets/images/upi_qr.webp") as ImageSourcePropType,
};

export const StaticAssets = {
  logo: LocalAssets.logo,
  leafA: LocalAssets.leafA,
  leafB: LocalAssets.leafB,
  plates: LocalAssets.plates,
  categories: LocalAssets.categories,
  drink: LocalAssets.drink,
  soup: LocalAssets.soup,
  chef: LocalAssets.chef,
  upiQr: LocalAssets.upiQr,
  chef2: LocalAssets.chef2,
  dietPlan1: LocalAssets.dietPlan1,
  dietPlan2: LocalAssets.dietPlan2,
  menuleaf: LocalAssets.menuleaf,
  shakes: LocalAssets.shakes,
  banquetSlides: LocalAssets.banquetSlides,
  mains: LocalAssets.mains,
  soups: LocalAssets.soups,
  soupMenuHero: LocalAssets.soupMenuHero,
  contact1: LocalAssets.contact1,
  contact2: LocalAssets.contact2,
  contactHeroBg: LocalAssets.contactHeroBg,
  aboutHeroBg: LocalAssets.aboutHeroBg,
  ourStoryImg: LocalAssets.ourStoryImg,
  abtusFlower: LocalAssets.abtusFlower,
  founderPhoto: LocalAssets.founderPhoto,
  chefPhoto: LocalAssets.chefPhoto,
  deliciousBg: LocalAssets.deliciousBg,
  sliceImg: LocalAssets.sliceImg,
  marinatedImg: LocalAssets.marinatedImg,
  bakeImg: LocalAssets.bakeImg,
  rosemary: LocalAssets.rosemary,
  rosemary1: LocalAssets.rosemary1,
};
