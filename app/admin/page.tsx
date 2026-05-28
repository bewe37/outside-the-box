"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { NEIGHBOURHOODS, formatNeighbourhood, type Neighbourhood } from "@/lib/data";
import { size, tracking, leading } from "@/lib/typography";

interface DynamicBox {
  id: number;
  title: string;
  address: string;
  neighbourhood: Neighbourhood;
  artist: string;
  year: number | "UNKNOWN";
  captured: string;
  description?: string;
  images?: string[];
}

const LABEL: React.CSSProperties = {
  fontSize: size.caption,
  lineHeight: leading.caption,
  letterSpacing: tracking.loose,
  textTransform: "uppercase",
  color: "#A8A8A8",
  marginBottom: 6,
  display: "block",
};

const INPUT: React.CSSProperties = {
  width: "100%",
  border: "1px solid #E4E4E4",
  borderRadius: 4,
  padding: "8px 10px",
  fontSize: size.meta,
  letterSpacing: tracking.normal,
  fontFamily: "inherit",
  color: "#202020",
  background: "#FAFAFA",
  outline: "none",
  boxSizing: "border-box",
};

const today = new Date();
const defaultCaptured = `${today.getMonth() + 1}/${today.getDate()}/${String(today.getFullYear()).slice(-2)}`;

const emptyForm = {
  title: "",
  address: "",
  neighbourhood: "LESLIEVILLE" as Neighbourhood,
  artist: "",
  year: today.getFullYear() as number | "UNKNOWN",
  captured: defaultCaptured,
  description: "",
};

interface PendingImage {
  file: File;
  preview: string;
}

// Upload one file, returns its stored path (or null on failure).
async function uploadFile(file: File): Promise<string | null> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch("/api/admin/upload", { method: "POST", body: fd });
  if (!r.ok) return null;
  const d = await r.json();
  return d.path as string;
}

// Year input with an "Unknown" toggle. Unchecked = number; checked = "UNKNOWN".
function YearField({
  value,
  onChange,
}: {
  value: number | "UNKNOWN";
  onChange: (value: number | "UNKNOWN") => void;
}) {
  const isUnknown = value === "UNKNOWN";
  return (
    <div>
      <label style={LABEL}>Year</label>
      <input
        style={{ ...INPUT, opacity: isUnknown ? 0.4 : 1 }}
        type="number"
        value={isUnknown ? "" : value}
        disabled={isUnknown}
        onChange={(e) => onChange(Number(e.target.value) || new Date().getFullYear())}
        min={2000}
        max={2099}
      />
      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 10, color: "#A8A8A8", letterSpacing: "0.04em", textTransform: "uppercase", cursor: "pointer", userSelect: "none" }}>
        <input
          type="checkbox"
          checked={isUnknown}
          onChange={(e) => onChange(e.target.checked ? "UNKNOWN" : new Date().getFullYear())}
          style={{ margin: 0, cursor: "pointer" }}
        />
        Unknown
      </label>
    </div>
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [logging, setLogging] = useState(false);

  const [boxes, setBoxes] = useState<DynamicBox[]>([]);
  const [customHoods, setCustomHoods] = useState<string[]>([]);
  const [newHood, setNewHood] = useState("");
  const [hoodError, setHoodError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/me")
      .then((r) => r.json())
      .then((d) => setAuthed(d.authenticated === true))
      .catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    if (authed) { loadBoxes(); loadHoods(); }
  }, [authed]);

  async function loadBoxes() {
    const r = await fetch("/api/admin/boxes");
    if (r.ok) setBoxes(await r.json());
  }

  async function loadHoods() {
    const r = await fetch("/api/admin/neighbourhoods");
    if (r.ok) setCustomHoods(await r.json());
  }

  // Built-in defaults plus admin-added neighbourhoods, for the form dropdown.
  const allHoods = [...NEIGHBOURHOODS, ...customHoods];

  async function addHood(e: React.FormEvent) {
    e.preventDefault();
    setHoodError("");
    const name = newHood.trim().toUpperCase();
    if (!name) return;
    const r = await fetch("/api/admin/neighbourhoods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (r.ok) {
      setCustomHoods(await r.json());
      setNewHood("");
    } else {
      const d = await r.json().catch(() => ({}));
      setHoodError(d.error || "Could not add.");
    }
  }

  async function removeHood(name: string) {
    const r = await fetch("/api/admin/neighbourhoods", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (r.ok) {
      setCustomHoods(await r.json());
      // If the form was set to the removed one, reset to the first built-in.
      setForm((f) => (f.neighbourhood === name ? { ...f, neighbourhood: NEIGHBOURHOODS[0] } : f));
    }
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLogging(true);
    setLoginError("");
    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLogging(false);
    if (r.ok) setAuthed(true);
    else setLoginError("Incorrect password.");
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthed(false);
    setBoxes([]);
  }

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const next: PendingImage[] = arr.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPending((prev) => [...prev, ...next]);
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  }

  function removeImage(idx: number) {
    setPending((prev) => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!form.title.trim()) { setError("Title is required."); return; }
    if (!form.address.trim()) { setError("Address is required."); return; }

    setSubmitting(true);

    const uploadedPaths: string[] = [];
    for (const item of pending) {
      const path = await uploadFile(item.file);
      if (!path) { setError("Image upload failed."); setSubmitting(false); return; }
      uploadedPaths.push(path);
    }

    const r = await fetch("/api/admin/boxes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, images: uploadedPaths }),
    });

    setSubmitting(false);

    if (r.ok) {
      pending.forEach((p) => URL.revokeObjectURL(p.preview));
      setForm(emptyForm);
      setPending([]);
      setSuccess("Box added.");
      loadBoxes();
    } else {
      setError("Failed to add box.");
    }
  }

  async function deleteBox(id: number) {
    if (!confirm("Delete this box?")) return;
    await fetch("/api/admin/boxes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    loadBoxes();
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (authed === null) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: '"Geist", system-ui, sans-serif' }}>
        <span style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#A8A8A8" }}>Loading…</span>
      </div>
    );
  }

  // ── Login ─────────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: '"Geist", system-ui, sans-serif', background: "#FAFAFA" }}>
        <form onSubmit={login} style={{ width: 320 }}>
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.04em", color: "#202020", marginBottom: 4 }}>OUTSIDETHEBOX</div>
            <div style={{ fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "#A8A8A8" }}>Admin access</div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={LABEL}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={INPUT} autoFocus placeholder="Enter admin password" />
          </div>
          {loginError && <div style={{ fontSize: 10, color: "#E55", marginBottom: 12 }}>{loginError}</div>}
          <button type="submit" disabled={logging} style={{ width: "100%", padding: "10px 0", background: "#202020", color: "#fff", border: "none", borderRadius: 4, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "inherit", cursor: logging ? "not-allowed" : "pointer", opacity: logging ? 0.6 : 1 }}>
            {logging ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", fontFamily: '"Geist", system-ui, sans-serif', background: "#FAFAFA", color: "#202020" }}>
      {/* Header */}
      <div style={{ height: 52, borderBottom: "1px solid #E8E8E8", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", background: "#fff", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "-0.04em" }}>OUTSIDETHEBOX</span>
          <span style={{ fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "#A8A8A8" }}>Admin</span>
        </div>
        <button onClick={logout} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "#A8A8A8", fontFamily: "inherit" }}>
          Sign out
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>
        <form onSubmit={submit}>
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "-0.03em", marginBottom: 4 }}>Add new box</div>
            <div style={{ fontSize: 9, letterSpacing: "0.04em", textTransform: "uppercase", color: "#A8A8A8" }}>Fill in the details and attach photos (any orientation)</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, alignItems: "start" }}>
            {/* Left: Photos */}
            <div>
              <label style={LABEL}>Photos</label>

              {/* Drop zone */}
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                style={{
                  border: `1.5px dashed ${isDragging ? "#202020" : "#D4D4D4"}`,
                  borderRadius: 6,
                  background: isDragging ? "#F5F5F5" : "#FAFAFA",
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  minHeight: 80,
                  transition: "border-color 0.15s",
                  marginBottom: pending.length > 0 ? 12 : 0,
                }}
              >
                <div style={{ fontSize: 18, color: "#C8C8C8", marginBottom: 6, lineHeight: 1 }}>+</div>
                <div style={{ fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: "#B8B8B8", textAlign: "center" }}>
                  Drop photos here or click to browse
                  <br />
                  <span style={{ color: "#D0D0D0" }}>JPG, PNG, WEBP — multiple ok</span>
                </div>
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFileInput} style={{ display: "none" }} />

              {/* Thumbnails grid */}
              {pending.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8 }}>
                  {pending.map((item, idx) => (
                    <div key={idx} style={{ position: "relative", borderRadius: 4, overflow: "hidden", background: "#F0F0F0" }}>
                      {/* Natural-size preview — contain so horizontals aren't cropped */}
                      <div style={{ position: "relative", width: "100%", paddingBottom: "75%", background: "#1A1A1A" }}>
                        <Image
                          src={item.preview}
                          alt=""
                          fill
                          style={{ objectFit: "contain" }}
                          unoptimized
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        style={{
                          position: "absolute",
                          top: 4,
                          right: 4,
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          background: "rgba(0,0,0,0.55)",
                          border: "none",
                          color: "#fff",
                          fontSize: 10,
                          lineHeight: "18px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontFamily: "inherit",
                        }}
                      >
                        ×
                      </button>
                      {idx === 0 && (
                        <div style={{ position: "absolute", bottom: 4, left: 4, background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 7, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 5px", borderRadius: 2 }}>
                          Cover
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Metadata */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={LABEL}>Title</label>
                <input style={INPUT} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. PIANO MAN" />
              </div>
              <div>
                <label style={LABEL}>Address</label>
                <input style={INPUT} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="e.g. 1220 Queen Street East" />
              </div>
              <div>
                <label style={LABEL}>Neighbourhood</label>
                <select style={{ ...INPUT, appearance: "none", cursor: "pointer" }} value={form.neighbourhood} onChange={(e) => setForm((f) => ({ ...f, neighbourhood: e.target.value as Neighbourhood }))}>
                  {allHoods.map((n) => <option key={n} value={n}>{formatNeighbourhood(n)}</option>)}
                </select>
              </div>
              <div>
                <label style={LABEL}>Artist</label>
                <input style={INPUT} value={form.artist} onChange={(e) => setForm((f) => ({ ...f, artist: e.target.value }))} placeholder="e.g. Marcus Webb" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <YearField value={form.year} onChange={(year) => setForm((f) => ({ ...f, year }))} />
                <div>
                  <label style={LABEL}>Captured</label>
                  <input style={INPUT} value={form.captured} onChange={(e) => setForm((f) => ({ ...f, captured: e.target.value }))} placeholder="M/D/YY" />
                </div>
              </div>
            </div>
          </div>

          {/* Description — full width */}
          <div style={{ marginTop: 28 }}>
            <label style={LABEL}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Describe the artwork — subject, style, story behind it…"
              rows={4}
              style={{ ...INPUT, resize: "vertical", lineHeight: 1.5 }}
            />
          </div>

          <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 16 }}>
            <button type="submit" disabled={submitting} style={{ padding: "10px 24px", background: "#202020", color: "#fff", border: "none", borderRadius: 4, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "inherit", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.6 : 1 }}>
              {submitting ? `Uploading ${pending.length} photo${pending.length !== 1 ? "s" : ""}…` : "Add box"}
            </button>
            {error && <span style={{ fontSize: 10, color: "#E55" }}>{error}</span>}
            {success && <span style={{ fontSize: 10, color: "#4A4" }}>{success}</span>}
          </div>
        </form>

        {/* Manage neighbourhoods */}
        <div style={{ marginTop: 56 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "-0.03em", marginBottom: 4 }}>Neighbourhoods</div>
          <div style={{ fontSize: 9, letterSpacing: "0.04em", textTransform: "uppercase", color: "#A8A8A8", marginBottom: 16 }}>
            Built-in plus any you add. New ones appear in the dropdown above and the gallery filter.
          </div>

          {/* Add row */}
          <form onSubmit={addHood} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, maxWidth: 420 }}>
            <input
              style={{ ...INPUT, textTransform: "uppercase" }}
              value={newHood}
              onChange={(e) => { setNewHood(e.target.value); setHoodError(""); }}
              placeholder="e.g. LIBERTY VILLAGE"
            />
            <button
              type="submit"
              disabled={!newHood.trim()}
              style={{ flexShrink: 0, padding: "8px 16px", background: "#202020", color: "#fff", border: "none", borderRadius: 4, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "inherit", cursor: newHood.trim() ? "pointer" : "not-allowed", opacity: newHood.trim() ? 1 : 0.5 }}
            >
              Add
            </button>
            {hoodError && <span style={{ fontSize: 10, color: "#E55" }}>{hoodError}</span>}
          </form>

          {/* Chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {NEIGHBOURHOODS.map((n) => (
              <span key={n} style={{ display: "inline-flex", alignItems: "center", padding: "5px 10px", border: "1px solid #E4E4E4", borderRadius: 999, fontSize: 10, letterSpacing: "0.04em", color: "#888", background: "#FAFAFA" }}>
                {formatNeighbourhood(n)}
              </span>
            ))}
            {customHoods.map((n) => (
              <span key={n} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 6px 5px 10px", border: "1px solid #D4D4D4", borderRadius: 999, fontSize: 10, letterSpacing: "0.04em", color: "#202020", background: "#fff" }}>
                {formatNeighbourhood(n)}
                <button
                  onClick={() => removeHood(n)}
                  aria-label={`Remove ${formatNeighbourhood(n)}`}
                  style={{ width: 16, height: 16, borderRadius: "50%", border: "none", background: "#EEE", color: "#666", cursor: "pointer", fontSize: 11, lineHeight: "16px", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit", padding: 0 }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Existing dynamic boxes */}
        {boxes.length > 0 && (
          <div style={{ marginTop: 56 }}>
            <div style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "#A8A8A8", marginBottom: 20 }}>
              Dynamic boxes ({boxes.length})
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
              {boxes.map((box) => (
                <BoxCard
                  key={box.id}
                  box={box}
                  neighbourhoods={allHoods}
                  onDelete={() => deleteBox(box.id)}
                  onSaved={loadBoxes}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Box card: view + inline edit ────────────────────────────────────────────
function BoxCard({
  box,
  neighbourhoods,
  onDelete,
  onSaved,
}: {
  box: DynamicBox;
  neighbourhoods: Neighbourhood[];
  onDelete: () => void;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [draft, setDraft] = useState({
    title: box.title,
    address: box.address,
    neighbourhood: box.neighbourhood,
    artist: box.artist,
    year: box.year,
    captured: box.captured,
    description: box.description ?? "",
  });
  // Existing uploaded paths kept on the box, plus newly added (not-yet-uploaded) files.
  const [keptImages, setKeptImages] = useState<string[]>(box.images ?? []);
  const [pending, setPending] = useState<PendingImage[]>([]);
  const editFileRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setDraft({
      title: box.title,
      address: box.address,
      neighbourhood: box.neighbourhood,
      artist: box.artist,
      year: box.year,
      captured: box.captured,
      description: box.description ?? "",
    });
    setKeptImages(box.images ?? []);
    setPending([]);
    setError("");
    setEditing(true);
  }

  function cancelEdit() {
    pending.forEach((p) => URL.revokeObjectURL(p.preview));
    setPending([]);
    setEditing(false);
  }

  function addFiles(files: FileList | File[]) {
    const next = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({ file, preview: URL.createObjectURL(file) }));
    setPending((prev) => [...prev, ...next]);
  }

  function removeKept(src: string) {
    setKeptImages((prev) => prev.filter((s) => s !== src));
  }

  function removePending(idx: number) {
    setPending((prev) => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  }

  async function save() {
    setError("");
    if (!draft.title.trim()) { setError("Title is required."); return; }
    if (!draft.address.trim()) { setError("Address is required."); return; }
    setSaving(true);

    const uploaded: string[] = [];
    for (const item of pending) {
      const path = await uploadFile(item.file);
      if (!path) { setError("Image upload failed."); setSaving(false); return; }
      uploaded.push(path);
    }

    const r = await fetch("/api/admin/boxes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, id: box.id, images: [...keptImages, ...uploaded] }),
    });
    setSaving(false);

    if (r.ok) {
      pending.forEach((p) => URL.revokeObjectURL(p.preview));
      setPending([]);
      setEditing(false);
      onSaved();
    } else {
      setError("Failed to save.");
    }
  }

  // ── View mode ──
  if (!editing) {
    return (
      <div style={{ background: "#fff", border: "1px solid #E8E8E8", borderRadius: 6, overflow: "hidden" }}>
        {box.images && box.images.length > 0 ? (
          <div style={{ display: "flex", gap: 1, background: "#1A1A1A" }}>
            {box.images.slice(0, 3).map((src, i) => (
              <div key={i} style={{ flex: 1, position: "relative", paddingBottom: "100%", background: "#111" }}>
                <Image src={src} alt="" fill style={{ objectFit: "contain" }} unoptimized />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ paddingBottom: "60%", background: "#F0F0F0", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 9, color: "#C0C0C0", letterSpacing: "0.04em", textTransform: "uppercase", position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}>No photos</span>
          </div>
        )}
        <div style={{ padding: "10px 12px 12px" }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 2 }}>{box.title}</div>
          <div style={{ fontSize: 9, color: "#A8A8A8", marginBottom: 2 }}>{box.artist}</div>
          <div style={{ fontSize: 9, color: "#C0C0C0", letterSpacing: "-0.02em", marginBottom: 10 }}>{formatNeighbourhood(box.neighbourhood)}</div>
          {box.images && box.images.length > 0 && (
            <div style={{ fontSize: 8, color: "#C0C0C0", marginBottom: 8 }}>{box.images.length} photo{box.images.length !== 1 ? "s" : ""}</div>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={startEdit} style={{ background: "none", border: "1px solid #E8E8E8", borderRadius: 3, padding: "4px 10px", cursor: "pointer", fontSize: 8, letterSpacing: "0.06em", textTransform: "uppercase", color: "#202020", fontFamily: "inherit" }}>
              Edit
            </button>
            <button onClick={onDelete} style={{ background: "none", border: "1px solid #E8E8E8", borderRadius: 3, padding: "4px 10px", cursor: "pointer", fontSize: 8, letterSpacing: "0.06em", textTransform: "uppercase", color: "#A8A8A8", fontFamily: "inherit" }}>
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Edit mode (spans full grid width) ──
  return (
    <div style={{ gridColumn: "1 / -1", background: "#fff", border: "1px solid #D4D4D4", borderRadius: 6, padding: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#202020", marginBottom: 16 }}>
        Editing box #{box.id}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
        {/* Photos */}
        <div>
          <label style={LABEL}>Photos</label>
          <div
            onClick={() => editFileRef.current?.click()}
            style={{ border: "1.5px dashed #D4D4D4", borderRadius: 6, background: "#FAFAFA", padding: 14, textAlign: "center", cursor: "pointer", marginBottom: 10 }}
          >
            <span style={{ fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase", color: "#B8B8B8" }}>Click to add photos</span>
          </div>
          <input ref={editFileRef} type="file" accept="image/*" multiple onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} style={{ display: "none" }} />

          {(keptImages.length > 0 || pending.length > 0) && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 8 }}>
              {keptImages.map((src) => (
                <div key={src} style={{ position: "relative", borderRadius: 4, overflow: "hidden", background: "#1A1A1A", paddingBottom: "75%" }}>
                  <Image src={src} alt="" fill style={{ objectFit: "contain" }} unoptimized />
                  <button type="button" onClick={() => removeKept(src)} aria-label="Remove photo" style={thumbX}>×</button>
                </div>
              ))}
              {pending.map((item, idx) => (
                <div key={idx} style={{ position: "relative", borderRadius: 4, overflow: "hidden", background: "#1A1A1A", paddingBottom: "75%" }}>
                  <Image src={item.preview} alt="" fill style={{ objectFit: "contain" }} unoptimized />
                  <button type="button" onClick={() => removePending(idx)} aria-label="Remove photo" style={thumbX}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={LABEL}>Title</label>
            <input style={INPUT} value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
          </div>
          <div>
            <label style={LABEL}>Address</label>
            <input style={INPUT} value={draft.address} onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))} />
          </div>
          <div>
            <label style={LABEL}>Neighbourhood</label>
            <select style={{ ...INPUT, appearance: "none", cursor: "pointer" }} value={draft.neighbourhood} onChange={(e) => setDraft((d) => ({ ...d, neighbourhood: e.target.value }))}>
              {/* Include the box's current value even if it's no longer in the list. */}
              {(neighbourhoods.includes(draft.neighbourhood) ? neighbourhoods : [draft.neighbourhood, ...neighbourhoods]).map((n) => (
                <option key={n} value={n}>{formatNeighbourhood(n)}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={LABEL}>Artist</label>
            <input style={INPUT} value={draft.artist} onChange={(e) => setDraft((d) => ({ ...d, artist: e.target.value }))} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <YearField value={draft.year} onChange={(year) => setDraft((d) => ({ ...d, year }))} />
            <div>
              <label style={LABEL}>Captured</label>
              <input style={INPUT} value={draft.captured} onChange={(e) => setDraft((d) => ({ ...d, captured: e.target.value }))} placeholder="M/D/YY" />
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <label style={LABEL}>Description</label>
        <textarea value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} rows={3} style={{ ...INPUT, resize: "vertical", lineHeight: 1.5 }} />
      </div>

      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={save} disabled={saving} style={{ padding: "8px 20px", background: "#202020", color: "#fff", border: "none", borderRadius: 4, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "inherit", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={cancelEdit} disabled={saving} style={{ padding: "8px 16px", background: "none", border: "1px solid #E4E4E4", borderRadius: 4, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "#A8A8A8", fontFamily: "inherit", cursor: "pointer" }}>
          Cancel
        </button>
        {error && <span style={{ fontSize: 10, color: "#E55" }}>{error}</span>}
      </div>
    </div>
  );
}

const thumbX: React.CSSProperties = {
  position: "absolute",
  top: 4,
  right: 4,
  width: 18,
  height: 18,
  borderRadius: "50%",
  background: "rgba(0,0,0,0.55)",
  border: "none",
  color: "#fff",
  fontSize: 11,
  lineHeight: "18px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "inherit",
  padding: 0,
};
