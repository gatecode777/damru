"use client";

import "@/styles/website/myprofile.css";
import "@/styles/website/rewards.css";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fmtDate, fmtDateTime } from "@/lib/formatDate";
import * as rewardApi from "@/lib/rewards/rewardApi";
import type { RewardTransaction } from "@/lib/rewards/rewardTypes";

export default function WebsiteRewardHistoryPage() {
  const [transactions,setTransactions]=useState<RewardTransaction[]>([]);
  const [page,setPage]=useState(1);
  const [totalPages,setTotalPages]=useState(1);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  const load=useCallback(async(targetPage:number)=>{
    setLoading(true);setError("");
    try{
      const data=await rewardApi.getHistory(targetPage,20);
      if("error" in data&&data.error)throw new Error(data.error);
      setTransactions(data.transactions||[]);
      setPage(data.page||1);
      setTotalPages(data.totalPages||1);
    }catch{setError("Unable to load your reward history.");}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{void load(1);},[load]);

  return(
    <main className="reward-history-page">
      <div className="reward-history-page__inner">
        <Link href="/my-profile?tab=rewards" className="reward-history-page__back">← Back to Damru Rewards</Link>
        <div className="reward-history-page__heading">
          <div><h1>Reward History</h1><p>Your complete Damru earning and redemption activity</p></div>
        </div>
        <div className="profile__card reward-history-page__card">
          {loading?<p className="reward-history-page__state">Loading reward history…</p>
          :error?<div className="reward-history-page__state"><p>{error}</p><button className="profile__update-btn" onClick={()=>void load(page)}>Retry</button></div>
          :transactions.length===0?<p className="reward-history-page__state">No Damru activity yet.</p>
          :transactions.map(tx=>(
            <div key={tx._id} className="rewards__tx-row">
              <div><p className="rewards__tx-desc">{tx.description||tx.category}</p><p className="rewards__tx-date">{fmtDateTime(tx.createdAt)}</p>{tx.type==="credit"&&tx.expiresAt&&<p className="rewards__tx-date">Expires {fmtDate(tx.expiresAt)}</p>}</div>
              <span className={`rewards__tx-amount rewards__tx-amount--${tx.type}`}>{tx.type==="credit"?"+":"−"}{tx.amount} Damru</span>
            </div>
          ))}
          {!loading&&!error&&totalPages>1&&<div className="reward-history-page__pagination"><button className="profile__btn-reorder" disabled={page<=1} onClick={()=>void load(page-1)}>Previous</button><span>Page {page} of {totalPages}</span><button className="profile__btn-reorder" disabled={page>=totalPages} onClick={()=>void load(page+1)}>Next</button></div>}
        </div>
      </div>
    </main>
  );
}
