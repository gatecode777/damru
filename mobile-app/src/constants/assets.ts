import { API_URL } from "../config";
import { ImageSourcePropType } from "react-native";

export const getWebImageUri = (path: string) => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_URL}${cleanPath}`;
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
  chef: require("../../assets/images/chef1.png") as ImageSourcePropType,
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
};
