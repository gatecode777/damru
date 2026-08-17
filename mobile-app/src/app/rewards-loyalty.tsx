import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { colors } from "@/config";
import { getLoyalty } from "@/services/rewardsApi";
import { trackRewardEvent } from "@/lib/rewardsAnalytics";
import type { LoyaltyResponse } from "@/types/rewards";
import { getApiErrorMessage } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";
import { PremiumRefreshControl } from "@/components/ui/PremiumRefreshControl";

function LoyaltySkeleton() {
  return (
    <View style={styles.content}>
      <View style={styles.hero}>
        <Skeleton width="60%" height={22} style={{ marginBottom: 8 }} />
        <Skeleton width="40%" height={12} style={{ marginBottom: 16 }} />
        <Skeleton height={8} radius={8} />
      </View>
      <Skeleton width={120} height={16} style={{ marginTop: 22, marginBottom: 10 }} />
      <Skeleton width="70%" height={13} style={{ marginBottom: 7 }} />
      <Skeleton width="55%" height={13} style={{ marginBottom: 7 }} />
      <Skeleton width={110} height={16} style={{ marginTop: 22, marginBottom: 10 }} />
      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.tier}>
          <Skeleton width="45%" height={15} style={{ marginBottom: 6 }} />
          <Skeleton width="35%" height={12} />
        </View>
      ))}
    </View>
  );
}

export default function RewardsLoyaltyScreen() {
  const [data, setData] = useState<LoyaltyResponse | null>(null); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState("");
  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const value = await getLoyalty();
      setData(value);
      trackRewardEvent("loyalty_progress_viewed", { percentage: value.progress.percentage });
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Unable to load loyalty details."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <View style={styles.container}><Stack.Screen options={{ title: "Loyalty Tiers", headerShown: true }} />
    {loading ? <LoyaltySkeleton /> : error && !data ? <View style={styles.center}><Text style={styles.error}>{error}</Text><Pressable style={styles.retry} onPress={() => load()}><Text style={styles.retryText}>Retry</Text></Pressable></View> :
      <ScrollView contentContainerStyle={styles.content} refreshControl={React.createElement(PremiumRefreshControl, { refreshing, onRefresh: () => load(true) })}>
        {data?.currentTier ? <><View style={styles.hero}><Text style={styles.title}>{data.currentTier.badgeIcon || "★"} {data.currentTier.name} Member</Text><Text style={styles.sub}>{data.qualification?.currentValue.toLocaleString("en-IN")} {data.qualification?.type.replace(/_/g, " ").toLowerCase()}</Text><View style={styles.track}><View style={[styles.fill, { width: `${data.progress.percentage}%` }]} /></View><Text style={styles.sub}>{data.nextTier ? `${data.progress.remainingValue.toLocaleString("en-IN")} remaining to ${data.nextTier.name}` : "Highest tier reached"}</Text></View>
          <Text style={styles.heading}>Your Benefits</Text>{data.benefits.length ? data.benefits.map(b => <Text key={b} style={styles.benefit}>✓ {b}</Text>) : <Text style={styles.sub}>No benefits configured.</Text>}
          <Text style={styles.heading}>Tier Ladder</Text>{data.tiers.map(t => <View key={t.id} style={[styles.tier, t.id === data.currentTier?.id && styles.active]}><Text style={styles.tierName}>{t.badgeIcon || "★"} {t.name}</Text><Text style={styles.sub}>From {t.minimumValue.toLocaleString("en-IN")} · {t.damruMultiplier}x</Text></View>)}</> : <Text style={styles.sub}>Loyalty tiers are not configured yet.</Text>}
      </ScrollView>}
  </View>;
}
const styles = StyleSheet.create({ container:{flex:1,backgroundColor:"#fffaf6"},center:{flex:1,alignItems:"center",justifyContent:"center",padding:30},content:{padding:18,paddingBottom:50},hero:{backgroundColor:"#fff",borderWidth:1,borderColor:"#fde3c8",borderRadius:18,padding:18},title:{fontFamily:"Poppins_700Bold",fontSize:22,color:colors.orange},sub:{fontFamily:"Poppins_400Regular",fontSize:12,color:"#756860",marginTop:5},track:{height:8,borderRadius:8,backgroundColor:"#f3ece6",overflow:"hidden",marginTop:16},fill:{height:"100%",backgroundColor:colors.orange},heading:{fontFamily:"Poppins_700Bold",fontSize:16,color:colors.ink,marginTop:22,marginBottom:8},benefit:{fontFamily:"Poppins_500Medium",fontSize:13,color:colors.ink,marginBottom:7},tier:{backgroundColor:"#fff",borderWidth:1,borderColor:"#eee3da",borderRadius:14,padding:14,marginBottom:9},active:{borderColor:colors.orange,backgroundColor:"#fff7ed"},tierName:{fontFamily:"Poppins_700Bold",fontSize:15,color:colors.ink},error:{fontFamily:"Poppins_500Medium",color:"#dc2626",textAlign:"center"},retry:{marginTop:12,backgroundColor:colors.orange,borderRadius:10,paddingHorizontal:18,paddingVertical:9},retryText:{color:"#fff",fontFamily:"Poppins_600SemiBold"} });
