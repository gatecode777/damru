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
  logo: require("../../assets/images/damru.png") as ImageSourcePropType,
  leafA: require("../../assets/images/Leafa.png") as ImageSourcePropType,
  leafB: require("../../assets/images/Leafb.png") as ImageSourcePropType,
  plates: [
    require("../../assets/images/plate1.png") as ImageSourcePropType,
    require("../../assets/images/plate2.png") as ImageSourcePropType,
    require("../../assets/images/plate3.png") as ImageSourcePropType,
    require("../../assets/images/plate4.png") as ImageSourcePropType,
  ],
  categories: {
    southIndian: require("../../assets/images/c1.png") as ImageSourcePropType,
    northIndian: require("../../assets/images/c2.png") as ImageSourcePropType,
    desserts: require("../../assets/images/c3.png") as ImageSourcePropType,
  },
  drink: require("../../assets/images/drink.png") as ImageSourcePropType,
  soup: require("../../assets/images/soup.png") as ImageSourcePropType,
  chef: require("../../assets/images/Excelentcook.png") as ImageSourcePropType,
  chef2: require("../../assets/images/chef2.png") as ImageSourcePropType,
  dietPlan1: require("../../assets/images/dietplan1.jpg") as ImageSourcePropType,
  dietPlan2: require("../../assets/images/dietplan2.jpg") as ImageSourcePropType,
  menuleaf: require("../../assets/images/menuleaf.png") as ImageSourcePropType,
  shakes: [
    require("../../assets/images/menu1.png") as ImageSourcePropType,
    require("../../assets/images/menu2.png") as ImageSourcePropType,
    require("../../assets/images/menu3.png") as ImageSourcePropType,
    require("../../assets/images/menu4.png") as ImageSourcePropType,
  ],
  banquetSlides: [
    require("../../assets/images/banquet/slide1.png") as ImageSourcePropType,
    require("../../assets/images/banquet/slide2.png") as ImageSourcePropType,
    require("../../assets/images/banquet/slide3.png") as ImageSourcePropType,
    require("../../assets/images/banquet/slide4.png") as ImageSourcePropType,
  ],
  mains: require("../../assets/images/mains.jpg") as ImageSourcePropType,
  soups: require("../../assets/images/soups.jpg") as ImageSourcePropType,
  soupMenuHero: require("../../assets/images/soupmenu.png") as ImageSourcePropType,
  contact1: require("../../assets/images/contact1.png") as ImageSourcePropType,
  contact2: require("../../assets/images/contact2.png") as ImageSourcePropType,
  contactHeroBg: require("../../assets/images/contact_hero_bg.png") as ImageSourcePropType,
  aboutHeroBg: require("../../assets/images/aboutus.png") as ImageSourcePropType,
  ourStoryImg: require("../../assets/images/ourstory.png") as ImageSourcePropType,
  abtusFlower: require("../../assets/images/abtusflower.png") as ImageSourcePropType,
  founderPhoto: require("../../assets/images/raja.png") as ImageSourcePropType,
  chefPhoto: require("../../assets/images/sandeep.png") as ImageSourcePropType,
  deliciousBg: require("../../assets/images/deliciouus.png") as ImageSourcePropType,
  sliceImg: require("../../assets/images/slice.png") as ImageSourcePropType,
  marinatedImg: require("../../assets/images/marinated.png") as ImageSourcePropType,
  bakeImg: require("../../assets/images/bake.png") as ImageSourcePropType,
  rosemary: require("../../assets/images/rosemary.png") as ImageSourcePropType,
  rosemary1: require("../../assets/images/rosemary1.png") as ImageSourcePropType,
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
