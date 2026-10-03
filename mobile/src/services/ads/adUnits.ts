import { Platform } from "react-native";
import { TestIds } from "react-native-google-mobile-ads";

/** Keep test inventory in every development build; live inventory is release-only. */
export const mobileAdUnits = {
  banner: __DEV__ ? TestIds.BANNER : "ca-app-pub-5763659746545616/7052242432",
  interstitial: __DEV__ ? TestIds.INTERSTITIAL : "ca-app-pub-5763659746545616/7340106332",
  appOpen: __DEV__ ? TestIds.APP_OPEN : "ca-app-pub-5763659746545616/8708853313",
};

export const mobileAdsSupported = Platform.OS === "android";

