import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { BannerAd, BannerAdSize } from "react-native-google-mobile-ads";
import { useAdsConsent } from "@/providers/AdsConsentProvider";
import { useAuth } from "@/providers/AuthProvider";
import { mobileAdUnits } from "@/services/ads/adUnits";
import { useAppTheme } from "@/theme/useAppTheme";

export const BottomBannerAd: React.FC = () => {
  const { canRequestAds } = useAdsConsent();
  const { isBootstrapped, systemSettings } = useAuth();
  const theme = useAppTheme();
  const [loaded, setLoaded] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  if (
    Platform.OS !== "android"
    || !canRequestAds
    || !isBootstrapped
    || systemSettings.mobileAdsEnabled === false
    || failed
  ) return null;

  return (
    <View
      accessibilityLabel="Publicidade"
      style={[styles.slot, { backgroundColor: theme.surface, borderTopColor: theme.border }, !loaded && styles.loading]}
    >
      <BannerAd
        unitId={mobileAdUnits.banner}
        size={BannerAdSize.BANNER}
        onAdLoaded={() => { setLoaded(true); setFailed(false); }}
        onAdFailedToLoad={() => { setLoaded(false); setFailed(true); }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  slot: {
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    height: 50,
    width: "100%",
  },
  loading: { opacity: 0 },
});

