"use client";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import SchemeCard from "@/components/SchemeCard";
import { apiSchemes } from "@/lib/api";
import type { GovernmentScheme } from "@/types";

const FILTERS = [
  { id: "", label: "All Schemes" },
  { id: "blade_finance", label: "⚡ Blade Finance" },
  { id: "chit_fund_default", label: "🏦 Chit Fund" },
  { id: "gold_loan_overdue", label: "💛 Gold Loan" },
  { id: "agricultural_debt", label: "🌾 Agricultural" },
  { id: "wedding_debt", label: "💍 Wedding" },
  { id: "festival_credit", label: "🪔 Festival" },
];

export default function SchemesPage() {
  const [schemes, setSchemes] = useState<GovernmentScheme[]>([]);
  const [activeFilter, setActiveFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiSchemes(activeFilter || undefined)
      .then(d => setSchemes(d.schemes))
      .finally(() => setLoading(false));
  }, [activeFilter]);

  return (
    <>
      <Navbar />
      <div className="page-container">
        <div className="content-container">
          <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "0.5rem" }}>
            <span className="gradient-text">Tamil Nadu Government Schemes</span>
          </h1>
          <p style={{ color: "rgba(241,245,249,0.6)", marginBottom: "2rem" }}>
            8 schemes matched by debt category — free legal aid, zero-interest credit, and direct benefits
          </p>

          {/* Filter pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "2rem" }}>
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                style={{
                  padding: "0.5rem 1rem", borderRadius: "9999px", fontSize: "0.875rem", cursor: "pointer",
                  border: `1px solid ${activeFilter === f.id ? "rgba(245,158,11,0.6)" : "rgba(255,255,255,0.1)"}`,
                  background: activeFilter === f.id ? "rgba(245,158,11,0.15)" : "transparent",
                  color: activeFilter === f.id ? "#fcd34d" : "rgba(241,245,249,0.7)",
                  transition: "all 0.2s",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="spinner" style={{ margin: "3rem auto" }} />
          ) : (
            <div className="grid-2">
              {schemes.map(scheme => <SchemeCard key={scheme.id} scheme={scheme} expanded />)}
            </div>
          )}

          {!loading && schemes.length === 0 && (
            <div style={{ textAlign: "center", padding: "3rem", color: "rgba(241,245,249,0.5)" }}>
              No schemes found for this category.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
