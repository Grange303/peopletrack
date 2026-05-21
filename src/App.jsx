import React, { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "./supabaseClient.js";

// ── Supabase data hooks ──
function useEmployees() {
  const [emps, setEmps] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const fetchEmps = useCallback(async () => {
    const { data } = await supabase.from("employees").select("*");
    if (data) setEmps(data.map(e => ({
      id: e.id, name: e.name, role: e.role, pin: e.pin, username: e.username || "",
      accountType: e.account_type || "employee",
      startDate: e.start_date, pickHistory: e.pick_history || [],
      docChecks: e.doc_checks || {}, notes: e.notes || "", privateNotes: e.private_notes || "",
      trackPickRate: e.track_pick_rate !== false,
      archived: e.archived || false
    })).sort((a, b) => a.name.localeCompare(b.name)));
    setLoaded(true);
  }, []);

  useEffect(() => { fetchEmps(); }, [fetchEmps]);

  const saveEmp = useCallback(async (emp) => {
    await supabase.from("employees").upsert({
      id: emp.id, name: emp.name, role: emp.role, pin: emp.pin, username: emp.username || "",
      account_type: emp.accountType || "employee", archived: emp.archived || false,
      start_date: emp.startDate, pick_history: emp.pickHistory,
      doc_checks: emp.docChecks, notes: emp.notes, private_notes: emp.privateNotes,
      track_pick_rate: emp.trackPickRate !== false
    });
    await fetchEmps();
  }, [fetchEmps]);

  const deleteEmp = useCallback(async (id) => {
    await supabase.from("employees").delete().eq("id", id);
    await fetchEmps();
  }, [fetchEmps]);

  return { emps, setEmps: (updater) => {
    const next = typeof updater === "function" ? updater(emps) : updater;
    setEmps(next);
    // Sync all changed employees
    next.forEach(emp => {
      const old = emps.find(e => e.id === emp.id);
      if (!old || JSON.stringify(old) !== JSON.stringify(emp)) {
        supabase.from("employees").upsert({
          id: emp.id, name: emp.name, role: emp.role, pin: emp.pin, username: emp.username || "",
          account_type: emp.accountType || "employee", archived: emp.archived || false,
          start_date: emp.startDate, pick_history: emp.pickHistory,
          doc_checks: emp.docChecks, notes: emp.notes, private_notes: emp.privateNotes,
          track_pick_rate: emp.trackPickRate !== false
        }).then(() => {});
      }
    });
  }, saveEmp, deleteEmp, loaded, refresh: fetchEmps };
}

function useDocs() {
  const [docs, setDocs] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const fetchDocs = useCallback(async () => {
    const { data } = await supabase.from("documents").select("*");
    if (data) setDocs(data.map(d => ({
      id: d.id, name: d.name, type: d.type, url: d.url || "",
      assignedTo: d.assigned_to || ["all"], contractText: d.contract_text || ""
    })));
    setLoaded(true);
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const saveDoc = useCallback(async (doc) => {
    await supabase.from("documents").upsert({
      id: doc.id, name: doc.name, type: doc.type, url: doc.url,
      assigned_to: doc.assignedTo, contract_text: doc.contractText
    });
    await fetchDocs();
  }, [fetchDocs]);

  const deleteDoc = useCallback(async (id) => {
    await supabase.from("documents").delete().eq("id", id);
    await fetchDocs();
  }, [fetchDocs]);

  return { docs, setDocs: (updater) => {
    const next = typeof updater === "function" ? updater(docs) : updater;
    setDocs(next);
    next.forEach(doc => {
      const old = docs.find(d => d.id === doc.id);
      if (!old || JSON.stringify(old) !== JSON.stringify(doc)) {
        supabase.from("documents").upsert({
          id: doc.id, name: doc.name, type: doc.type, url: doc.url,
          assigned_to: doc.assignedTo, contract_text: doc.contractText
        }).then(() => {});
      }
    });
  }, saveDoc, deleteDoc, loaded, refresh: fetchDocs };
}

function useSettings() {
  const [managerPin, setManagerPin] = useState("0000");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("settings").select("*").eq("key", "managerPin").single();
      if (data) setManagerPin(data.value);
      setLoaded(true);
    })();
  }, []);
  return { managerPin, loaded };
}

// Language stored locally per device (intentionally - each person picks their own)
function useLang() {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem("pt_lang") || "en"; } catch { return "en"; }
  });
  const set = useCallback((l) => { setLang(l); try { localStorage.setItem("pt_lang", l); } catch {} }, []);
  return [lang, set];
}

// ── Onboarding hooks ──
function useOnboardingDocs() {
  const [obDocs, setObDocs] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const fetch_ = useCallback(async () => {
    const { data } = await supabase.from("onboarding_documents").select("*").eq("active", true).order("sort_order");
    if (data) setObDocs(data);
    setLoaded(true);
  }, []);
  useEffect(() => { fetch_(); }, [fetch_]);
  return { obDocs, loaded, refresh: fetch_ };
}

function useOnboardingSubs() {
  const [subs, setSubs] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const fetch_ = useCallback(async () => {
    const { data } = await supabase.from("onboarding_submissions").select("*");
    if (data) setSubs(data);
    setLoaded(true);
  }, []);
  useEffect(() => { fetch_(); }, [fetch_]);
  const saveSub = useCallback(async (sub) => {
    await supabase.from("onboarding_submissions").upsert(sub);
    await fetch_();
  }, [fetch_]);
  return { subs, loaded, saveSub, refresh: fetch_ };
}

// Flagging: check questionnaire answers for "yes" on flagged questions
function computeFlags(doc, answers) {
  if (doc.kind !== "questionnaire") return [];
  const body = doc.body;
  const flags = [];
  (body.questions || []).forEach(q => {
    const ans = answers?.[q.id]?.value;
    if (q.flag_on && ans === q.flag_on) {
      flags.push({ questionId: q.id, question: q.text, answer: ans });
    }
  });
  return flags;
}

const todayDate = () => new Date().toISOString().slice(0, 10);
const nowDateTime = () => { const d = new Date(); return d.toISOString().slice(0, 10) + " " + d.toTimeString().slice(0, 5); };
function getTarget(wk) { if (wk <= 0) return 30; const ramp = 30 + (wk - 1) * 2; if (wk >= 18 || ramp >= 60) return 60; return ramp; }
function getAssignedDocs(docs, empId) { return docs.filter(d => d.assignedTo?.includes("all") || d.assignedTo?.includes(empId)); }
const docPct = (ch, aDocs) => { if (!aDocs.length) return 0; return Math.round((Object.keys(ch).filter(k => aDocs.some(d => d.id === k)).length / aDocs.length) * 100); };

const LANG_NAMES = { en:"English",bg:"Bulgarian",kk:"Kazakh",ky:"Kyrgyz",mk:"Macedonian",ru:"Russian",uk:"Ukrainian" };

async function translateText(text, targetLang) {
  if (targetLang === "en") return text;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 4000,
        messages: [{ role: "user", content: `Translate the following employment document text into ${LANG_NAMES[targetLang] || targetLang}. Return ONLY the translated text.\n\n${text}` }] })
    });
    const data = await res.json();
    return data.content?.filter(b => b.type === "text").map(b => b.text).join("\n") || text;
  } catch { return text; }
}

function downloadCert(docName, chk) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Contract Certificate</title><style>body{font-family:'Segoe UI',Arial,sans-serif;max-width:700px;margin:40px auto;padding:40px;color:#222;line-height:1.6}h1{font-size:22px;border-bottom:2px solid #2563eb;padding-bottom:12px;color:#1e40af}.f{margin:12px 0;padding:12px 16px;background:#f8f9fa;border-radius:8px;border:1px solid #e5e7eb}.fl{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:4px}.fv{font-size:15px;font-weight:600}.d{margin:20px 0;padding:16px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;font-size:13px;color:#92400e}.sb{margin-top:20px;padding:20px;border:1px solid #d1d5db;border-radius:8px;text-align:center;background:#fafafa}.sb img{max-width:300px}.ft{margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#999;text-align:center}</style></head><body><h1>Contract Signing Certificate</h1><div class="f"><div class="fl">Document</div><div class="fv">${docName}</div></div><div class="f"><div class="fl">Full Name</div><div class="fv">${chk.typedName||chk.signedBy||"N/A"}</div></div><div class="f"><div class="fl">Date &amp; Time</div><div class="fv">${chk.dateTime||chk.date}</div></div><div class="d"><strong>Declaration:</strong><br/>"I confirm that I have read, understood, and agree to the terms of this document. I have scrolled through and reviewed the full contract text."</div><div class="f"><div class="fl">Scrolled to bottom</div><div class="fv">✓ Confirmed</div></div><div class="f"><div class="fl">Read &amp; understood</div><div class="fv">✓ Confirmed</div></div><h2 style="font-size:16px;color:#555;margin-top:30px">Signature</h2><div class="sb">${chk.sig && chk.sig !== "demo" ? `<img src="${chk.sig}" alt="Signature"/>` : '<p style="color:#999">No signature on file</p>'}</div><div class="ft">Generated by PeopleTrack</div></body></html>`;
  const blob = new Blob([html], { type: "text/html" }); const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = `Contract_${(chk.typedName||chk.signedBy||"unknown").replace(/\s+/g,"_")}_${chk.date||todayDate()}.html`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

// Download onboarding document audit certificate
function downloadOnboardingCert(doc, sub, empName) {
  const body = doc.body;
  let answersHtml = "";

  if (doc.kind === "acknowledge") {
    answersHtml = `<div class="f"><div class="fl">Type</div><div class="fv">Read &amp; Acknowledge</div></div>`;
    (body.sections || []).forEach(sec => {
      answersHtml += `<div class="sec"><div class="sec-t">${sec.title}</div><div class="sec-c">${sec.content}</div></div>`;
    });
    answersHtml += `<div class="f"><div class="fl">Employee acknowledged all sections</div><div class="fv">✓ Confirmed</div></div>`;
  } else if (doc.kind === "checklist") {
    answersHtml = `<div class="f"><div class="fl">Type</div><div class="fv">Training Checklist</div></div>`;
    const items = body.items || [];
    const ticked = sub.answers?.items || {};
    const tickedCount = items.filter(it => ticked[it.id]).length;
    answersHtml += `<div class="f"><div class="fl">Completion</div><div class="fv">${tickedCount} / ${items.length} items confirmed</div></div>`;
    answersHtml += `<table class="tbl"><thead><tr><th>Item</th><th>Status</th></tr></thead><tbody>`;
    items.forEach(it => {
      const done = !!ticked[it.id];
      answersHtml += `<tr><td>${it.text}</td><td style="color:${done ? '#16a34a' : '#dc2626'};font-weight:700">${done ? '✓ Completed' : '✗ Not completed'}</td></tr>`;
    });
    answersHtml += `</tbody></table>`;
  } else if (doc.kind === "questionnaire") {
    answersHtml = `<div class="f"><div class="fl">Type</div><div class="fv">Health / Safety Questionnaire</div></div>`;
    const questions = body.questions || [];
    const hasFlags = (sub.flag_reasons || []).length > 0;
    if (hasFlags) {
      answersHtml += `<div class="flag"><strong>⚠ FLAGGED ANSWERS (${sub.flag_reasons.length})</strong><br/>`;
      sub.flag_reasons.forEach(f => { answersHtml += `• ${f.question} — answered <strong>${f.answer}</strong><br/>`; });
      answersHtml += `</div>`;
    }
    answersHtml += `<table class="tbl"><thead><tr><th>Question</th><th>Answer</th><th>Flagged</th></tr></thead><tbody>`;
    questions.forEach(q => {
      const val = sub.answers?.[q.id]?.value || "—";
      const flagged = q.flag_on && val === q.flag_on;
      answersHtml += `<tr style="${flagged ? 'background:#fef2f2' : ''}"><td>${q.text}</td><td style="font-weight:700;color:${val === 'yes' ? '#b91c1c' : '#16a34a'}">${val.toUpperCase()}</td><td>${flagged ? '⚠ YES' : '—'}</td></tr>`;
    });
    answersHtml += `</tbody></table>`;
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Onboarding Certificate - ${doc.title}</title>
<style>
body{font-family:'Segoe UI',Arial,sans-serif;max-width:750px;margin:40px auto;padding:40px;color:#222;line-height:1.6}
h1{font-size:22px;border-bottom:2px solid #2563eb;padding-bottom:12px;color:#1e40af;margin-bottom:20px}
h2{font-size:16px;color:#555;margin-top:30px;margin-bottom:10px}
.f{margin:10px 0;padding:12px 16px;background:#f8f9fa;border-radius:8px;border:1px solid #e5e7eb}
.fl{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:4px}
.fv{font-size:15px;font-weight:600;color:#222}
.sec{margin:10px 0;padding:12px 16px;background:#fff;border:1px solid #e5e7eb;border-radius:8px}
.sec-t{font-weight:700;font-size:14px;margin-bottom:4px;color:#1e40af}
.sec-c{font-size:13px;color:#555}
.flag{margin:16px 0;padding:14px 16px;background:#fef2f2;border:2px solid #fca5a5;border-radius:8px;font-size:13px;color:#991b1b}
.tbl{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}
.tbl th{text-align:left;padding:8px 10px;background:#f1f5f9;border:1px solid #e2e8f0;font-size:11px;text-transform:uppercase;color:#64748b}
.tbl td{padding:8px 10px;border:1px solid #e2e8f0}
.sb{margin-top:16px;padding:20px;border:1px solid #d1d5db;border-radius:8px;text-align:center;background:#fafafa}
.sb img{max-width:300px;height:auto}
.decl{margin:16px 0;padding:14px 16px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;font-size:13px;color:#92400e}
.ft{margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#999;text-align:center}
.row{display:flex;gap:20px;margin-top:20px}
.row>div{flex:1}
@media print{body{margin:20px;padding:20px}}
</style></head><body>
<h1>Onboarding Document — Audit Record</h1>

<div class="f"><div class="fl">Document</div><div class="fv">${doc.title}</div></div>
<div class="f"><div class="fl">Employee</div><div class="fv">${empName}</div></div>
<div class="f"><div class="fl">Submitted</div><div class="fv">${sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : "N/A"}</div></div>
<div class="f"><div class="fl">Status</div><div class="fv" style="color:${sub.status==='approved'?'#16a34a':sub.status==='rejected'?'#dc2626':'#d97706'}">${(sub.status || "pending").toUpperCase()}</div></div>
${sub.reviewed_at ? `<div class="f"><div class="fl">Reviewed</div><div class="fv">${new Date(sub.reviewed_at).toLocaleString()}</div></div>` : ""}
${sub.manager_notes ? `<div class="f"><div class="fl">Manager Notes</div><div class="fv">${sub.manager_notes}</div></div>` : ""}

<h2>Document Content &amp; Answers</h2>
${answersHtml}

<div class="decl"><strong>Employee Declaration:</strong><br/>
"I, ${empName}, confirm that I have read, understood, and completed this document truthfully."</div>

<div class="row">
<div>
<h2>Employee Signature</h2>
<div class="sb">${sub.signature_png ? `<img src="${sub.signature_png}" alt="Employee Signature"/>` : '<p style="color:#999">No signature on file</p>'}</div>
<div style="font-size:11px;color:#888;margin-top:6px;text-align:center">${empName} · ${sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : ""}</div>
</div>
<div>
<h2>Manager Countersignature</h2>
<div class="sb">${sub.manager_signature_png ? `<img src="${sub.manager_signature_png}" alt="Manager Signature"/>` : '<p style="color:#999">No countersignature on file</p>'}</div>
<div style="font-size:11px;color:#888;margin-top:6px;text-align:center">${sub.reviewed_at ? `Reviewed ${new Date(sub.reviewed_at).toLocaleString()}` : ""}</div>
</div>
</div>

<div class="ft">Generated by PeopleTrack · This document is an audit record of an onboarding submission within the PeopleTrack system.<br/>Document ID: ${doc.id} · Submission ID: ${sub.id}</div>
</body></html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Onboarding_${doc.title.replace(/[^a-zA-Z0-9]/g, "_")}_${empName.replace(/\s+/g, "_")}_${todayDate()}.html`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

function exportXLS(emps, docs, t) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(emps.map(emp => { const ad = getAssignedDocs(docs, emp.id); const last = emp.pickHistory[emp.pickHistory.length-1]; return { Employee:emp.name, Role:emp.role, Start:emp.startDate||"", "Pick Rate":last?last.rate:"N/A", Target:last?getTarget(last.wk):"N/A", "Meets Target":last?(last.rate>=getTarget(last.wk)?"Yes":"No"):"N/A", "Doc %":docPct(emp.docChecks,ad)+"%", Done:`${ad.filter(d=>emp.docChecks[d.id]).length}/${ad.length}` }; })), "Overview");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(emps.map(emp => { const row = { Employee:emp.name }; docs.forEach(d => { const a = d.assignedTo?.includes("all")||d.assignedTo?.includes(emp.id); if(!a)row[d.name]="Not Assigned"; else if(emp.docChecks[d.id]){const c=emp.docChecks[d.id]; if(c.status==="signed") row[d.name]=`SIGNED - Confirmed ${c.signedConfirmedAt||c.dateTime||c.date}`; else if(c.status==="opened") row[d.name]=`OPENED ${c.dateTime||c.date} - Awaiting signature`; else row[d.name]=`Reviewed ${c.dateTime||c.date}`;} else row[d.name]="INCOMPLETE"; }); return row; })), "Document Status");
  const pr=[]; emps.forEach(e=>e.pickHistory.forEach(p=>pr.push({Employee:e.name,Week:p.wk,Date:p.date,Rate:p.rate,Target:getTarget(p.wk),Met:p.rate>=getTarget(p.wk)?"Yes":"No"}))); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pr.length?pr:[{Note:"No data"}]), "Pick Rates");
  XLSX.writeFile(wb, `PeopleTrack_${todayDate()}.xlsx`);
}

// ── Translations ──
const T = {
  en:{appName:"PeopleTrack",managerView:"Manager View",signIn:"Sign In",pinPlaceholder:"PIN",pinPrompt:"Enter your PIN to sign in",pinError:"PIN not recognised.",demoPins:"Demo PINs",manager:"Manager",employees:"Employees",employee:"Employee",dashboard:"Dashboard",documents:"Documents",signOut:"Sign Out",dashDesc:"Team performance and document compliance overview",avgPickRate:"Avg Pick Rate",avgDocCompliance:"Avg Doc Compliance",fullyCompliant:"Fully Compliant",needsAttention:"Needs Attention",teamOverview:"Team Overview",role:"Role",pickRate:"Pick Rate",trend:"Trend",docProgress:"Document Progress",status:"Status",excellent:"Excellent",attention:"Attention",inProgress:"In Progress",search:"Search...",add:"+ Add",addEmployee:"Add Employee",fullName:"Full Name",pinForSignIn:"PIN (for sign-in)",cancel:"Cancel",teamMembers:"team members",docManageDesc:"Manage SOPs and contracts",addDocument:"+ Add Document",docName:"Document Name",linkToDoc:"Link to Document (optional)",linkHint:"Google Drive, SharePoint, or Dropbox link",type:"Type",sop:"SOP",contract:"Contract",sops:"Standard Operating Procedures",contracts:"Contracts",remove:"Remove",removeEmployee:"Remove Employee",signed:"signed",backToEmployees:"← Back",pickRateHistory:"Pick Rate History",weeklyTracking:"Weekly tracking with targets",addWeek:"+ Add Week",week:"Week",rate:"Rate",target:"Target",addPickRate:"Add Pick Rate",weekStarting:"Week Starting",weekNumber:"Week Number (1–26+)",pickRate0100:"Pick Rate (0–100)",sopsDocs:"SOPs",contractsDocs:"Contracts",managerNotes:"Shared Notes",privateNotes:"Private Notes",notesPlaceholder:"Visible to employee...",privateNotesPlaceholder:"Only you can see...",welcome:"Welcome",latestPickRate:"Latest Pick Rate",pickRateTrend:"Pick Rate Trend",yourDocStatus:"Your document review status",reviewSign:"Sign Contract",viewDoc:"View Doc",viewSig:"View Sig",signBelow:"Draw your signature below",clear:"Clear",confirmSign:"Confirm & Sign",signHere:"Sign here",signature:"Signature",close:"Close",needData:"Need at least 2 weeks of data.",language:"Language",reviewed:"Reviewed",startDate:"Start Date",aboveTarget:"Above Target",belowTarget:"Below Target",targetLine:"Target",wk:"Wk",assignDocs:"Assign",assignedDocs:"Assigned Documents",allEmployees:"All Employees",noDocsAssigned:"No documents assigned",notesFromManager:"Notes from your manager",exportExcel:"Export Report",confirmReview:"I have reviewed and understood this document",markReviewed:"Mark as Reviewed",reviewedAt:"Reviewed",typeName:"Type your full name",downloadCert:"Download Certificate",contractText:"Contract Text",contractTextHint:"Employees must scroll through this before signing",scrollToBottom:"Please scroll to the bottom to continue",readConfirm:"I confirm that I have read, understood, and agree to the terms",declaration:"I confirm that I have read, understood, and agree to the terms of this document. I have scrolled through and reviewed the full contract text. I understand that by typing my name and providing my signature, I am acknowledging my agreement.",translationDisclaimer:"This is a translation for your understanding. The English version is the authoritative document.",translating:"Translating...",scrollReminder:"↓ Scroll down to read the full document",loading:"Loading..."},
  bg:{appName:"PeopleTrack",managerView:"Мениджър",signIn:"Вход",pinPlaceholder:"ПИН",pinPrompt:"Въведете вашия ПИН",pinError:"ПИН не е разпознат.",demoPins:"Демо ПИН",manager:"Мениджър",employees:"Служители",employee:"Служител",dashboard:"Табло",documents:"Документи",signOut:"Изход",dashDesc:"Преглед на ефективност",avgPickRate:"Средна норма",avgDocCompliance:"Съответствие",fullyCompliant:"Напълно съответстващи",needsAttention:"Внимание",teamOverview:"Преглед",role:"Роля",pickRate:"Норма",trend:"Тенденция",docProgress:"Документи",status:"Статус",excellent:"Отличен",attention:"Внимание",inProgress:"В процес",search:"Търсене...",add:"+ Добави",addEmployee:"Добави служител",fullName:"Пълно име",pinForSignIn:"ПИН",cancel:"Отказ",teamMembers:"членове",docManageDesc:"Управление на документи",addDocument:"+ Добави",docName:"Име",linkToDoc:"Линк",linkHint:"Google Drive, SharePoint или Dropbox",type:"Тип",sop:"СОП",contract:"Договор",sops:"Стандартни процедури",contracts:"Договори",remove:"Премахни",removeEmployee:"Премахни",signed:"подписани",backToEmployees:"← Назад",pickRateHistory:"История",weeklyTracking:"Седмично проследяване",addWeek:"+ Седмица",week:"Седмица",rate:"Норма",target:"Цел",addPickRate:"Добави",weekStarting:"Начало",weekNumber:"Номер (1–26+)",pickRate0100:"Норма (0–100)",sopsDocs:"СОП",contractsDocs:"Договори",managerNotes:"Споделени бележки",privateNotes:"Лични бележки",notesPlaceholder:"За служителя...",privateNotesPlaceholder:"Само вие виждате...",welcome:"Добре дошли",latestPickRate:"Последна норма",pickRateTrend:"Тенденция",yourDocStatus:"Статус на документи",reviewSign:"Подпиши",viewDoc:"Виж",viewSig:"Подпис",signBelow:"Подпишете се",clear:"Изчисти",confirmSign:"Потвърди",signHere:"Подпис тук",signature:"Подпис",close:"Затвори",needData:"Необходими са 2 седмици.",language:"Език",reviewed:"Прегледан",startDate:"Начало",aboveTarget:"Над целта",belowTarget:"Под целта",targetLine:"Цел",wk:"Сд",assignDocs:"Задай",assignedDocs:"Зададени",allEmployees:"Всички",noDocsAssigned:"Няма документи",notesFromManager:"Бележки от мениджъра",exportExcel:"Експорт",confirmReview:"Прочетох и разбрах",markReviewed:"Маркирай",reviewedAt:"Прегледан",typeName:"Въведете името си",downloadCert:"Изтегли сертификат",contractText:"Текст на договора",contractTextHint:"Служителите трябва да превъртят до края",scrollToBottom:"Превъртете до края за да продължите",readConfirm:"Потвърждавам, че съм прочел, разбрал и съм съгласен",declaration:"Потвърждавам, че съм прочел, разбрал и съм съгласен с условията на този документ.",translationDisclaimer:"Това е превод за ваше разбиране. Английската версия е официалният документ.",translating:"Превеждане...",scrollReminder:"↓ Превъртете надолу",loading:"Зареждане..."},
  kk:{appName:"PeopleTrack",managerView:"Менеджер",signIn:"Кіру",pinPlaceholder:"ПИН",pinPrompt:"ПИН енгізіңіз",pinError:"ПИН танылмады.",demoPins:"Демо ПИН",manager:"Менеджер",employees:"Қызметкерлер",employee:"Қызметкер",dashboard:"Тақта",documents:"Құжаттар",signOut:"Шығу",dashDesc:"Команда шолуы",avgPickRate:"Орт. жинау",avgDocCompliance:"Сәйкестік",fullyCompliant:"Толық сәйкес",needsAttention:"Назар",teamOverview:"Команда",role:"Рөлі",pickRate:"Жинау",trend:"Тенденция",docProgress:"Құжаттар",status:"Мәртебе",excellent:"Тамаша",attention:"Назар",inProgress:"Орындалуда",search:"Іздеу...",add:"+ Қосу",addEmployee:"Қызметкер қосу",fullName:"Толық аты",pinForSignIn:"ПИН",cancel:"Бас тарту",teamMembers:"мүшелер",docManageDesc:"Құжаттарды басқару",addDocument:"+ Қосу",docName:"Атауы",linkToDoc:"Сілтеме",linkHint:"Google Drive, SharePoint немесе Dropbox",type:"Түрі",sop:"СОП",contract:"Келісімшарт",sops:"Стандартты процедуралар",contracts:"Келісімшарттар",remove:"Жою",removeEmployee:"Жою",signed:"қол қойылды",backToEmployees:"← Артқа",pickRateHistory:"Тарих",weeklyTracking:"Апталық бақылау",addWeek:"+ Апта",week:"Апта",rate:"Көрсеткіш",target:"Мақсат",addPickRate:"Қосу",weekStarting:"Апта басы",weekNumber:"Нөмір (1–26+)",pickRate0100:"Жинау (0–100)",sopsDocs:"СОП",contractsDocs:"Келісімшарттар",managerNotes:"Ортақ жазбалар",privateNotes:"Жеке жазбалар",notesPlaceholder:"Қызметкерге...",privateNotesPlaceholder:"Тек сіз...",welcome:"Қош келдіңіз",latestPickRate:"Соңғы жинау",pickRateTrend:"Тенденция",yourDocStatus:"Құжат мәртебесі",reviewSign:"Қол қою",viewDoc:"Көру",viewSig:"Қолтаңба",signBelow:"Қол қойыңыз",clear:"Тазалау",confirmSign:"Растау",signHere:"Мұнда",signature:"Қолтаңба",close:"Жабу",needData:"2 апта қажет.",language:"Тіл",reviewed:"Қаралды",startDate:"Бастау",aboveTarget:"Жоғары",belowTarget:"Төмен",targetLine:"Мақсат",wk:"Ап",assignDocs:"Тағайындау",assignedDocs:"Тағайындалған",allEmployees:"Барлығы",noDocsAssigned:"Құжат жоқ",notesFromManager:"Менеджер жазбалары",exportExcel:"Экспорт",confirmReview:"Мен оқып түсіндім",markReviewed:"Белгілеу",reviewedAt:"Қаралды",typeName:"Атыңызды жазыңыз",downloadCert:"Сертификат жүктеу",contractText:"Келісімшарт мәтіні",contractTextHint:"Соңына дейін оқуы керек",scrollToBottom:"Жалғастыру үшін соңына дейін жылжытыңыз",readConfirm:"Мен оқып, түсініп, шарттарына келісемін",declaration:"Мен осы құжатты оқып, түсініп, шарттарына келісемін.",translationDisclaimer:"Бұл аударма. Ағылшын нұсқасы ресми құжат.",translating:"Аударылуда...",scrollReminder:"↓ Төмен жылжытыңыз",loading:"Жүктелуде..."},
  ky:{appName:"PeopleTrack",managerView:"Менеджер",signIn:"Кирүү",pinPlaceholder:"ПИН",pinPrompt:"ПИН киргизиңиз",pinError:"ПИН таанылган жок.",demoPins:"Демо ПИН",manager:"Менеджер",employees:"Кызматкерлер",employee:"Кызматкер",dashboard:"Панель",documents:"Документтер",signOut:"Чыгуу",dashDesc:"Команда сереби",avgPickRate:"Орт. чогултуу",avgDocCompliance:"Шайкештик",fullyCompliant:"Толук шайкеш",needsAttention:"Көңүл",teamOverview:"Команда",role:"Ролу",pickRate:"Чогултуу",trend:"Тенденция",docProgress:"Документтер",status:"Статус",excellent:"Мыкты",attention:"Көңүл",inProgress:"Жүрүүдө",search:"Издөө...",add:"+ Кошуу",addEmployee:"Кызматкер кошуу",fullName:"Толук аты",pinForSignIn:"ПИН",cancel:"Жокко чыгаруу",teamMembers:"мүчөлөр",docManageDesc:"Документтерди башкаруу",addDocument:"+ Кошуу",docName:"Аталышы",linkToDoc:"Шилтеме",linkHint:"Google Drive, SharePoint же Dropbox",type:"Түрү",sop:"СОП",contract:"Контракт",sops:"Стандарттуу процедуралар",contracts:"Контракттар",remove:"Жок кылуу",removeEmployee:"Жок кылуу",signed:"кол коюлду",backToEmployees:"← Артка",pickRateHistory:"Тарых",weeklyTracking:"Жумалык максаттар",addWeek:"+ Жума",week:"Жума",rate:"Көрсөткүч",target:"Максат",addPickRate:"Кошуу",weekStarting:"Жума башы",weekNumber:"Номер (1–26+)",pickRate0100:"Чогултуу (0–100)",sopsDocs:"СОП",contractsDocs:"Контракттар",managerNotes:"Бөлүшүлгөн жазуулар",privateNotes:"Жеке жазуулар",notesPlaceholder:"Кызматкерге...",privateNotesPlaceholder:"Сиз гана...",welcome:"Кош келиңиз",latestPickRate:"Акыркы чогултуу",pickRateTrend:"Тенденция",yourDocStatus:"Документ статусу",reviewSign:"Кол коюу",viewDoc:"Көрүү",viewSig:"Кол тамга",signBelow:"Кол коюңуз",clear:"Тазалоо",confirmSign:"Ырастоо",signHere:"Кол коюңуз",signature:"Кол тамга",close:"Жабуу",needData:"2 жума керек.",language:"Тил",reviewed:"Каралды",startDate:"Башталган күн",aboveTarget:"Жогору",belowTarget:"Төмөн",targetLine:"Максат",wk:"Жм",assignDocs:"Дайындоо",assignedDocs:"Дайындалган",allEmployees:"Баары",noDocsAssigned:"Документ жок",notesFromManager:"Менеджер жазуулары",exportExcel:"Экспорт",confirmReview:"Мен окуп түшүндүм",markReviewed:"Белгилөө",reviewedAt:"Каралды",typeName:"Атыңызды жазыңыз",downloadCert:"Сертификат жүктөө",contractText:"Контракт тексти",contractTextHint:"Аягына чейин окушу керек",scrollToBottom:"Улантуу үчүн аягына чейин жылдырыңыз",readConfirm:"Мен окуп, түшүнүп, шарттарына макулмун",declaration:"Мен бул документти окуп, түшүнүп, шарттарына макулмун.",translationDisclaimer:"Бул котормо. Англис версиясы расмий документ.",translating:"Которулууда...",scrollReminder:"↓ Төмөн жылдырыңыз",loading:"Жүктөлүүдө..."},
  mk:{appName:"PeopleTrack",managerView:"Менаџер",signIn:"Најава",pinPlaceholder:"ПИН",pinPrompt:"Внесете ПИН",pinError:"ПИН не е препознаен.",demoPins:"Демо ПИН",manager:"Менаџер",employees:"Вработени",employee:"Вработен",dashboard:"Табла",documents:"Документи",signOut:"Одјава",dashDesc:"Преглед на тим",avgPickRate:"Просек",avgDocCompliance:"Усогласеност",fullyCompliant:"Целосно",needsAttention:"Внимание",teamOverview:"Тим",role:"Улога",pickRate:"Норма",trend:"Тренд",docProgress:"Документи",status:"Статус",excellent:"Одличен",attention:"Внимание",inProgress:"Во тек",search:"Барај...",add:"+ Додади",addEmployee:"Додади вработен",fullName:"Целосно име",pinForSignIn:"ПИН",cancel:"Откажи",teamMembers:"членови",docManageDesc:"Управување со документи",addDocument:"+ Додади",docName:"Име",linkToDoc:"Линк",linkHint:"Google Drive, SharePoint или Dropbox",type:"Тип",sop:"СОП",contract:"Договор",sops:"Стандардни процедури",contracts:"Договори",remove:"Отстрани",removeEmployee:"Отстрани",signed:"потпишани",backToEmployees:"← Назад",pickRateHistory:"Историја",weeklyTracking:"Неделно следење",addWeek:"+ Недела",week:"Недела",rate:"Норма",target:"Цел",addPickRate:"Додади",weekStarting:"Почеток",weekNumber:"Број (1–26+)",pickRate0100:"Норма (0–100)",sopsDocs:"СОП",contractsDocs:"Договори",managerNotes:"Споделени белешки",privateNotes:"Приватни белешки",notesPlaceholder:"За вработениот...",privateNotesPlaceholder:"Само вие...",welcome:"Добредојдовте",latestPickRate:"Последна норма",pickRateTrend:"Тренд",yourDocStatus:"Статус на документи",reviewSign:"Потпиши",viewDoc:"Погледни",viewSig:"Потпис",signBelow:"Потпишете се",clear:"Исчисти",confirmSign:"Потврди",signHere:"Потпис тука",signature:"Потпис",close:"Затвори",needData:"2 недели.",language:"Јазик",reviewed:"Прегледан",startDate:"Датум",aboveTarget:"Над целта",belowTarget:"Под целта",targetLine:"Цел",wk:"Нд",assignDocs:"Додели",assignedDocs:"Доделени",allEmployees:"Сите",noDocsAssigned:"Нема",notesFromManager:"Белешки",exportExcel:"Извоз",confirmReview:"Го прочитав и разбрав",markReviewed:"Означи",reviewedAt:"Прегледан",typeName:"Внесете име",downloadCert:"Преземи сертификат",contractText:"Текст на договор",contractTextHint:"Мора да скролираат до крај",scrollToBottom:"Скролирајте до крај за да продолжите",readConfirm:"Потврдувам дека прочитав, разбрав и се согласувам",declaration:"Потврдувам дека прочитав, разбрав и се согласувам со условите.",translationDisclaimer:"Ова е превод. Англиската верзија е официјална.",translating:"Се преведува...",scrollReminder:"↓ Скролирајте надолу",loading:"Се вчитува..."},
  ru:{appName:"PeopleTrack",managerView:"Менеджер",signIn:"Войти",pinPlaceholder:"ПИН",pinPrompt:"Введите ПИН",pinError:"ПИН не распознан.",demoPins:"Демо ПИН",manager:"Менеджер",employees:"Сотрудники",employee:"Сотрудник",dashboard:"Панель",documents:"Документы",signOut:"Выход",dashDesc:"Обзор команды",avgPickRate:"Ср. норма",avgDocCompliance:"Соответствие",fullyCompliant:"Полное",needsAttention:"Внимание",teamOverview:"Команда",role:"Роль",pickRate:"Норма",trend:"Тенденция",docProgress:"Документы",status:"Статус",excellent:"Отлично",attention:"Внимание",inProgress:"В процессе",search:"Поиск...",add:"+ Добавить",addEmployee:"Добавить",fullName:"Полное имя",pinForSignIn:"ПИН",cancel:"Отмена",teamMembers:"членов",docManageDesc:"Управление документами",addDocument:"+ Добавить",docName:"Название",linkToDoc:"Ссылка",linkHint:"Google Drive, SharePoint или Dropbox",type:"Тип",sop:"СОП",contract:"Договор",sops:"Стандартные процедуры",contracts:"Договоры",remove:"Удалить",removeEmployee:"Удалить",signed:"подписано",backToEmployees:"← Назад",pickRateHistory:"История",weeklyTracking:"Еженедельный учёт",addWeek:"+ Неделю",week:"Неделя",rate:"Норма",target:"Цель",addPickRate:"Добавить",weekStarting:"Начало",weekNumber:"Номер (1–26+)",pickRate0100:"Норма (0–100)",sopsDocs:"СОП",contractsDocs:"Договоры",managerNotes:"Общие заметки",privateNotes:"Приватные",notesPlaceholder:"Для сотрудника...",privateNotesPlaceholder:"Только вы...",welcome:"Добро пожаловать",latestPickRate:"Последняя норма",pickRateTrend:"Тенденция",yourDocStatus:"Статус документов",reviewSign:"Подписать",viewDoc:"Открыть",viewSig:"Подпись",signBelow:"Распишитесь",clear:"Очистить",confirmSign:"Подтвердить",signHere:"Подпись",signature:"Подпись",close:"Закрыть",needData:"Минимум 2 недели.",language:"Язык",reviewed:"Просмотрен",startDate:"Дата начала",aboveTarget:"Выше цели",belowTarget:"Ниже цели",targetLine:"Цель",wk:"Нд",assignDocs:"Назначить",assignedDocs:"Назначенные",allEmployees:"Все",noDocsAssigned:"Нет",notesFromManager:"Заметки менеджера",exportExcel:"Экспорт",confirmReview:"Я прочитал и понял",markReviewed:"Отметить",reviewedAt:"Просмотрен",typeName:"Введите имя",downloadCert:"Скачать сертификат",contractText:"Текст договора",contractTextHint:"Должны прокрутить до конца",scrollToBottom:"Прокрутите до конца чтобы продолжить",readConfirm:"Я подтверждаю, что прочитал, понял и согласен",declaration:"Я подтверждаю, что прочитал, понял и согласен с условиями этого документа.",translationDisclaimer:"Это перевод. Английская версия является официальной.",translating:"Перевод...",scrollReminder:"↓ Прокрутите вниз",loading:"Загрузка..."},
  uk:{appName:"PeopleTrack",managerView:"Менеджер",signIn:"Увійти",pinPlaceholder:"ПІН",pinPrompt:"Введіть ПІН",pinError:"ПІН не розпізнано.",demoPins:"Демо ПІН",manager:"Менеджер",employees:"Співробітники",employee:"Співробітник",dashboard:"Панель",documents:"Документи",signOut:"Вихід",dashDesc:"Огляд команди",avgPickRate:"Сер. норма",avgDocCompliance:"Відповідність",fullyCompliant:"Повна",needsAttention:"Увага",teamOverview:"Команда",role:"Роль",pickRate:"Норма",trend:"Тенденція",docProgress:"Документи",status:"Статус",excellent:"Відмінно",attention:"Увага",inProgress:"В процесі",search:"Пошук...",add:"+ Додати",addEmployee:"Додати",fullName:"Повне ім'я",pinForSignIn:"ПІН",cancel:"Скасувати",teamMembers:"членів",docManageDesc:"Керування документами",addDocument:"+ Додати",docName:"Назва",linkToDoc:"Посилання",linkHint:"Google Drive, SharePoint або Dropbox",type:"Тип",sop:"СОП",contract:"Договір",sops:"Стандартні процедури",contracts:"Договори",remove:"Видалити",removeEmployee:"Видалити",signed:"підписано",backToEmployees:"← Назад",pickRateHistory:"Історія",weeklyTracking:"Щотижневий облік",addWeek:"+ Тиждень",week:"Тиждень",rate:"Норма",target:"Ціль",addPickRate:"Додати",weekStarting:"Початок",weekNumber:"Номер (1–26+)",pickRate0100:"Норма (0–100)",sopsDocs:"СОП",contractsDocs:"Договори",managerNotes:"Спільні нотатки",privateNotes:"Приватні",notesPlaceholder:"Для співробітника...",privateNotesPlaceholder:"Тільки ви...",welcome:"Ласкаво просимо",latestPickRate:"Остання норма",pickRateTrend:"Тенденція",yourDocStatus:"Статус документів",reviewSign:"Підписати",viewDoc:"Відкрити",viewSig:"Підпис",signBelow:"Підпишіться",clear:"Очистити",confirmSign:"Підтвердити",signHere:"Підпис",signature:"Підпис",close:"Закрити",needData:"2 тижні.",language:"Мова",reviewed:"Переглянуто",startDate:"Дата",aboveTarget:"Вище цілі",belowTarget:"Нижче цілі",targetLine:"Ціль",wk:"Тж",assignDocs:"Призначити",assignedDocs:"Призначені",allEmployees:"Всі",noDocsAssigned:"Немає",notesFromManager:"Нотатки менеджера",exportExcel:"Експорт",confirmReview:"Я прочитав і зрозумів",markReviewed:"Позначити",reviewedAt:"Переглянуто",typeName:"Введіть ім'я",downloadCert:"Завантажити сертифікат",contractText:"Текст договору",contractTextHint:"Повинні прокрутити до кінця",scrollToBottom:"Прокрутіть до кінця щоб продовжити",readConfirm:"Я підтверджую, що прочитав, зрозумів і погоджуюсь",declaration:"Я підтверджую, що прочитав, зрозумів і погоджуюсь з умовами цього документа.",translationDisclaimer:"Це переклад. Англійська версія є офіційною.",translating:"Перекладається...",scrollReminder:"↓ Прокрутіть вниз",loading:"Завантаження..."},
};
const LL = { en:"English",bg:"Български",kk:"Қазақша",ky:"Кыргызча",mk:"Македонски",ru:"Русский",uk:"Українська" };

const C = { bg:"#0c0e14",surface:"#14171f",surfaceAlt:"#1a1e2a",border:"#252a38",text:"#e4e7f0",textMuted:"#7d829a",textDim:"#4a4f65",accent:"#3b82f6",accentSoft:"rgba(59,130,246,0.1)",green:"#22c55e",greenSoft:"rgba(34,197,94,0.1)",amber:"#eab308",amberSoft:"rgba(234,179,8,0.1)",red:"#ef4444",redSoft:"rgba(239,68,68,0.1)",purple:"#8b5cf6",targetYellow:"#fbbf24" };

// ── Stable components (outside App to prevent re-render issues) ──
function Modal({ children, onClose, wide }) {
  return (<div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999 }} onClick={onClose}><div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:28,width:wide?560:420,maxHeight:"90vh",overflowY:"auto" }} onClick={e=>e.stopPropagation()}>{children}</div></div>);
}

function LangSel({ lang, setLang }) {
  return (<select value={lang} onChange={e=>setLang(e.target.value)} style={{ padding:"6px 10px",borderRadius:7,border:`1px solid ${C.border}`,background:C.surfaceAlt,color:C.text,fontSize:12,outline:"none",cursor:"pointer",fontFamily:"inherit" }}>{Object.entries(LL).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>);
}

function ContractSignFlow({ doc, emp, lang, t, onSign, onCancel }) {
  const scrollRef = useRef(null); const canvasRef = useRef(null); const drawing = useRef(false);
  const [scrolledOk, setScrolledOk] = useState(false);
  const [readOk, setReadOk] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [hasDrawn, setHasDrawn] = useState(false);
  const [translated, setTranslated] = useState("");
  const [translating, setTranslating] = useState(false);
  const ct = doc.contractText || "";
  const needsTr = lang !== "en" && ct;
  useEffect(() => { if(needsTr){ setTranslating(true); translateText(ct,lang).then(t=>{ setTranslated(t); setTranslating(false); }); } }, [ct,lang,needsTr]);
  const displayText = needsTr ? (translated||ct) : ct;
  const handleScroll = () => { const el=scrollRef.current; if(!el)return; if(el.scrollHeight-el.scrollTop-el.clientHeight<20) setScrolledOk(true); };
  const gp=e=>{const r=canvasRef.current.getBoundingClientRect();const p=e.touches?e.touches[0]:e;return{x:p.clientX-r.left,y:p.clientY-r.top};};
  const sd=e=>{e.preventDefault();drawing.current=true;const ctx=canvasRef.current.getContext("2d");const p=gp(e);ctx.beginPath();ctx.moveTo(p.x,p.y);};
  const mv=e=>{if(!drawing.current)return;e.preventDefault();setHasDrawn(true);const ctx=canvasRef.current.getContext("2d");const p=gp(e);ctx.lineTo(p.x,p.y);ctx.strokeStyle=C.text;ctx.lineWidth=2.5;ctx.lineCap="round";ctx.lineJoin="round";ctx.stroke();};
  const ed=()=>{drawing.current=false;};
  const clearSig=()=>{canvasRef.current.getContext("2d").clearRect(0,0,canvasRef.current.width,canvasRef.current.height);setHasDrawn(false);};
  const canSign=scrolledOk&&readOk&&typedName.trim().length>1&&hasDrawn;
  const inp={width:"100%",padding:"10px 12px",borderRadius:8,border:`1px solid ${C.border}`,background:C.surfaceAlt,color:C.text,fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"inherit"};
  const lbl={display:"block",fontSize:11,color:C.textMuted,marginBottom:5,textTransform:"uppercase",letterSpacing:0.8,fontWeight:600};
  return (<div>
    {ct && <div style={{marginBottom:16}}>
      {needsTr&&!translating&&<div style={{padding:"8px 12px",borderRadius:8,background:"rgba(251,191,36,0.1)",border:"1px solid rgba(251,191,36,0.25)",color:C.targetYellow,fontSize:12,marginBottom:10}}>⚠️ {t.translationDisclaimer}</div>}
      {translating&&<div style={{padding:20,textAlign:"center",color:C.textMuted,fontSize:13}}>{t.translating}</div>}
      {!translating&&<><div style={{position:"relative"}}><div ref={scrollRef} onScroll={handleScroll} style={{maxHeight:280,overflowY:"auto",padding:"16px 18px",background:"#fff",color:"#222",borderRadius:10,border:`2px solid ${scrolledOk?C.green:C.border}`,fontSize:13,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{displayText}</div>{!scrolledOk&&<div style={{position:"absolute",bottom:0,left:0,right:0,height:50,background:"linear-gradient(transparent, rgba(255,255,255,0.95))",borderRadius:"0 0 10px 10px",display:"flex",alignItems:"flex-end",justifyContent:"center",paddingBottom:8,pointerEvents:"none"}}><span style={{fontSize:12,color:C.accent,fontWeight:600}}>{t.scrollReminder}</span></div>}</div>{!scrolledOk&&<div style={{fontSize:12,color:C.red,marginTop:8,fontWeight:600}}>{t.scrollToBottom}</div>}</>}
    </div>}
    {scrolledOk&&<div style={{marginBottom:16}}><label onClick={()=>setReadOk(!readOk)} style={{display:"flex",alignItems:"flex-start",gap:10,cursor:"pointer",padding:"12px 14px",borderRadius:10,background:readOk?C.greenSoft:C.surfaceAlt,border:`1px solid ${readOk?"rgba(34,197,94,0.25)":C.border}`}}><div style={{width:22,height:22,borderRadius:6,border:`2px solid ${readOk?C.green:C.textDim}`,background:readOk?C.green:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>{readOk&&<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7L6 10L11 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}</div><div style={{fontSize:13,color:readOk?C.green:C.text,fontWeight:500,lineHeight:1.5}}>{t.readConfirm}</div></label></div>}
    {readOk&&<div>
      <div style={{padding:"12px 14px",borderRadius:8,background:"rgba(251,191,36,0.08)",border:"1px solid rgba(251,191,36,0.15)",color:C.text,fontSize:12,lineHeight:1.6,marginBottom:16}}><strong style={{color:C.targetYellow}}>Declaration:</strong><br/>{t.declaration}</div>
      <div style={{marginBottom:14}}><div style={lbl}>{t.typeName}</div><input value={typedName} onChange={e=>setTypedName(e.target.value)} placeholder={t.fullName} style={inp}/></div>
      <div style={lbl}>{t.signBelow}</div>
      <div style={{border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden",background:C.surfaceAlt,marginBottom:12,position:"relative"}}><canvas ref={canvasRef} width={320} height={120} style={{display:"block",width:"100%",height:120,cursor:"crosshair",touchAction:"none"}} onMouseDown={sd} onMouseMove={mv} onMouseUp={ed} onMouseLeave={ed} onTouchStart={sd} onTouchMove={mv} onTouchEnd={ed}/>{!hasDrawn&&<div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",color:C.textDim,fontSize:13,pointerEvents:"none"}}>{t.signHere}</div>}</div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><button onClick={clearSig} style={{padding:"7px 14px",borderRadius:7,border:`1px solid ${C.border}`,background:"transparent",color:C.textMuted,fontWeight:600,fontSize:12,cursor:"pointer"}}>{t.clear}</button><button onClick={onCancel} style={{padding:"7px 14px",borderRadius:7,border:`1px solid ${C.border}`,background:"transparent",color:C.textMuted,fontWeight:600,fontSize:12,cursor:"pointer"}}>{t.cancel}</button><button onClick={()=>canSign&&onSign(canvasRef.current.toDataURL("image/png"),typedName.trim())} style={{padding:"7px 18px",borderRadius:7,border:"none",background:C.green,color:"#fff",fontWeight:600,fontSize:12,cursor:"pointer",opacity:canSign?1:0.4}}>{t.confirmSign}</button></div>
    </div>}
  </div>);
}

function PickChart({ history, width=340, height=160, t }) {
  if(!history||history.length<2)return<div style={{color:C.textDim,fontSize:12,padding:20}}>{t.needData}</div>;
  const pad={t:18,r:14,b:30,l:38};const w=width-pad.l-pad.r,h=height-pad.t-pad.b;
  const pts=history.map((p,i)=>({x:pad.l+(i/(history.length-1))*w,y:pad.t+h-(p.rate/100)*h,...p}));
  const tPts=history.map((p,i)=>({x:pad.l+(i/(history.length-1))*w,y:pad.t+h-(getTarget(p.wk||27)/100)*h}));
  const lp=pts.map((p,i)=>`${i===0?"M":"L"}${p.x},${p.y}`).join(" ");
  const ap=`${lp} L${pts[pts.length-1].x},${pad.t+h} L${pts[0].x},${pad.t+h} Z`;
  const tLine=tPts.map((p,i)=>`${i===0?"M":"L"}${p.x},${p.y}`).join(" ");
  return(<svg width={width} height={height} style={{display:"block",overflow:"visible"}}>{[0,25,50,75,100].map(v=>{const y=pad.t+h-(v/100)*h;return(<g key={v}><line x1={pad.l} y1={y} x2={pad.l+w} y2={y} stroke={C.border} strokeWidth={1}/><text x={pad.l-8} y={y+4} fill={C.textDim} fontSize={9} textAnchor="end" fontFamily="'JetBrains Mono',monospace">{v}</text></g>);})}<defs><linearGradient id="aGS" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.accent} stopOpacity="0.2"/><stop offset="100%" stopColor={C.accent} stopOpacity="0"/></linearGradient></defs><path d={ap} fill="url(#aGS)"/><path d={tLine} fill="none" stroke={C.targetYellow} strokeWidth={2} strokeDasharray="6,4" opacity={0.7}/><path d={lp} fill="none" stroke={C.accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>{pts.map((p,i)=>{const tgt=getTarget(p.wk||27);const col=p.rate>=tgt?C.green:C.red;return(<g key={i}><circle cx={p.x} cy={p.y} r={5} fill={C.surface} stroke={col} strokeWidth={2.5}/><text x={p.x} y={pad.t+h+14} fill={C.textMuted} fontSize={8} textAnchor="middle" fontFamily="'JetBrains Mono',monospace">{t.wk}{p.wk||"?"}</text><text x={p.x} y={p.y-10} fill={col} fontSize={10} fontWeight={700} textAnchor="middle" fontFamily="'JetBrains Mono',monospace">{p.rate}</text></g>);})}<text x={pad.l+w+4} y={tPts[tPts.length-1].y+4} fill={C.targetYellow} fontSize={9} fontWeight={600} fontFamily="'JetBrains Mono',monospace" opacity={0.8}>{t.targetLine}</text></svg>);
}

function Badge({children,color,bg}){return<span style={{display:"inline-block",padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:600,color,background:bg}}>{children}</span>;}
function Ring({percent,size=48,stroke=4,color}){const r=(size-stroke)/2,ci=2*Math.PI*r,off=ci-(percent/100)*ci;return(<svg width={size} height={size} style={{transform:"rotate(-90deg)"}}><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={stroke}/><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={ci} strokeDashoffset={off} strokeLinecap="round" style={{transition:"stroke-dashoffset 0.5s"}}/></svg>);}

// ── Onboarding: Employee Document View ──
function OnboardingDocView({ doc, existing, empName, onSubmit, onCancel, t }) {
  const body = doc.body;
  const [answers, setAnswers] = useState(existing?.answers || {});
  const [sigPng, setSigPng] = useState(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const gp = e => { const r = canvasRef.current.getBoundingClientRect(); const p = e.touches ? e.touches[0] : e; return { x: p.clientX - r.left, y: p.clientY - r.top }; };
  const sd = e => { e.preventDefault(); drawing.current = true; const ctx = canvasRef.current.getContext("2d"); const p = gp(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const mv = e => { if (!drawing.current) return; e.preventDefault(); setHasDrawn(true); const ctx = canvasRef.current.getContext("2d"); const p = gp(e); ctx.lineTo(p.x, p.y); ctx.strokeStyle = C.text; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke(); };
  const ed = () => { drawing.current = false; };
  const clearSig = () => { canvasRef.current.getContext("2d").clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); setHasDrawn(false); };

  const isComplete = () => {
    if (doc.kind === "acknowledge") return !!answers.acknowledged;
    if (doc.kind === "checklist") return (body.items || []).every(it => answers.items?.[it.id]);
    if (doc.kind === "questionnaire") return (body.questions || []).every(q => answers[q.id]?.value === "yes" || answers[q.id]?.value === "no");
    return false;
  };
  const canSubmit = isComplete() && hasDrawn;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const sig = canvasRef.current.toDataURL("image/png");
    onSubmit(answers, sig);
  };

  const lbl = { display: "block", fontSize: 11, color: C.textMuted, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 };

  return (
    <div>
      <button onClick={onCancel} style={{ background: "transparent", border: "none", color: C.accent, cursor: "pointer", fontSize: 13, fontWeight: 600, marginBottom: 14, padding: 0 }}>← Back</button>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{doc.title}</h2>
      {body.intro && <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>{body.intro}</p>}

      {/* Acknowledge type */}
      {doc.kind === "acknowledge" && (
        <div>
          {(body.sections || []).map((sec, i) => (
            <div key={i} style={{ marginBottom: 16, padding: "14px 16px", background: C.surfaceAlt, borderRadius: 10, border: `1px solid ${C.border}` }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: C.text }}>{sec.title}</div>
              <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>{sec.content}</div>
            </div>
          ))}
          <label onClick={() => setAnswers({ ...answers, acknowledged: !answers.acknowledged })} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "12px 14px", borderRadius: 10, background: answers.acknowledged ? C.greenSoft : C.surfaceAlt, border: `1px solid ${answers.acknowledged ? "rgba(34,197,94,0.25)" : C.border}`, marginTop: 12 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${answers.acknowledged ? C.green : C.textDim}`, background: answers.acknowledged ? C.green : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{answers.acknowledged && <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7L6 10L11 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}</div>
            <span style={{ fontSize: 13, fontWeight: 600, color: answers.acknowledged ? C.green : C.text }}>I have read and understood this document</span>
          </label>
        </div>
      )}

      {/* Checklist type */}
      {doc.kind === "checklist" && (
        <div>
          {(body.items || []).map(item => {
            const ticked = !!answers.items?.[item.id];
            return (
              <label key={item.id} onClick={() => { const items = { ...(answers.items || {}), [item.id]: !ticked }; setAnswers({ ...answers, items }); }} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "10px 14px", borderRadius: 8, background: ticked ? C.greenSoft : C.surfaceAlt, border: `1px solid ${ticked ? "rgba(34,197,94,0.18)" : C.border}`, marginBottom: 6 }}>
                <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${ticked ? C.green : C.textDim}`, background: ticked ? C.green : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>{ticked && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}</div>
                <span style={{ fontSize: 13, color: ticked ? C.green : C.text, lineHeight: 1.5 }}>{item.text}</span>
              </label>
            );
          })}
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>
            {Object.values(answers.items || {}).filter(Boolean).length} / {(body.items || []).length} completed
          </div>
        </div>
      )}

      {/* Questionnaire type */}
      {doc.kind === "questionnaire" && (
        <div>
          {(body.questions || []).map(q => {
            const val = answers[q.id]?.value;
            const flagged = q.flag_on && val === q.flag_on;
            return (
              <div key={q.id} style={{ padding: "12px 14px", borderRadius: 10, background: flagged ? C.redSoft : C.surfaceAlt, border: `1px solid ${flagged ? "rgba(239,68,68,0.2)" : C.border}`, marginBottom: 8 }}>
                <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5, marginBottom: 10 }}>{q.text}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {["yes", "no"].map(opt => (
                    <button key={opt} onClick={() => setAnswers({ ...answers, [q.id]: { value: opt } })} style={{ padding: "6px 20px", borderRadius: 7, border: `1px solid ${val === opt ? (opt === "yes" && q.flag_on === "yes" ? C.red : C.green) : C.border}`, background: val === opt ? (opt === "yes" && q.flag_on === "yes" ? C.redSoft : C.greenSoft) : "transparent", color: val === opt ? (opt === "yes" && q.flag_on === "yes" ? C.red : C.green) : C.textMuted, fontWeight: 600, fontSize: 12, cursor: "pointer", textTransform: "capitalize" }}>{opt === "yes" ? "Yes" : "No"}</button>
                  ))}
                </div>
                {flagged && <div style={{ fontSize: 11, color: C.red, marginTop: 6, fontWeight: 600 }}>⚠ This answer will be flagged for manager review</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* Signature */}
      {isComplete() && (
        <div style={{ marginTop: 20 }}>
          <div style={{ padding: "12px 14px", borderRadius: 8, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.15)", color: C.text, fontSize: 12, lineHeight: 1.6, marginBottom: 14 }}>
            <strong style={{ color: C.targetYellow }}>Declaration:</strong> I, {empName}, confirm that I have read, understood, and completed this document truthfully.
          </div>
          <div style={lbl}>Sign below</div>
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", background: C.surfaceAlt, marginBottom: 12, position: "relative" }}>
            <canvas ref={canvasRef} width={320} height={120} style={{ display: "block", width: "100%", height: 120, cursor: "crosshair", touchAction: "none" }} onMouseDown={sd} onMouseMove={mv} onMouseUp={ed} onMouseLeave={ed} onTouchStart={sd} onTouchMove={mv} onTouchEnd={ed} />
            {!hasDrawn && <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", color: C.textDim, fontSize: 13, pointerEvents: "none" }}>Sign here</div>}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={clearSig} style={{ padding: "7px 14px", borderRadius: 7, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>{t.clear}</button>
            <button onClick={handleSubmit} style={{ padding: "7px 18px", borderRadius: 7, border: "none", background: C.green, color: "#fff", fontWeight: 600, fontSize: 12, cursor: "pointer", opacity: canSubmit ? 1 : 0.4 }}>Submit & Sign</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Onboarding: Manager Review Detail ──
function ManagerReviewDetail({ sub, doc, empName, onApprove, onReject, onBack, t }) {
  const [notes, setNotes] = useState(sub.manager_notes || "");
  const [sigPng, setSigPng] = useState(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const gp = e => { const r = canvasRef.current.getBoundingClientRect(); const p = e.touches ? e.touches[0] : e; return { x: p.clientX - r.left, y: p.clientY - r.top }; };
  const sd = e => { e.preventDefault(); drawing.current = true; const ctx = canvasRef.current.getContext("2d"); const p = gp(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const mv = e => { if (!drawing.current) return; e.preventDefault(); setHasDrawn(true); const ctx = canvasRef.current.getContext("2d"); const p = gp(e); ctx.lineTo(p.x, p.y); ctx.strokeStyle = C.text; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke(); };
  const ed = () => { drawing.current = false; };
  const body = doc.body;

  return (
    <div>
      <button onClick={onBack} style={{ background: "transparent", border: "none", color: C.accent, cursor: "pointer", fontSize: 13, fontWeight: 600, marginBottom: 14, padding: 0 }}>← Back</button>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{doc.title}</h2>
      <div style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>Submitted by {empName} · {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : ""}</div>

      {sub.flag_reasons?.length > 0 && (
        <div style={{ padding: "12px 14px", borderRadius: 10, background: C.redSoft, border: "1px solid rgba(239,68,68,0.2)", marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: C.red, marginBottom: 8 }}>⚠ Flagged Answers ({sub.flag_reasons.length})</div>
          {sub.flag_reasons.map((f, i) => (
            <div key={i} style={{ fontSize: 12, color: C.text, marginBottom: 4 }}>• {f.question} — answered <strong style={{ color: C.red }}>{f.answer}</strong></div>
          ))}
        </div>
      )}

      {/* Show answers */}
      {doc.kind === "acknowledge" && <div style={{ padding: "10px 14px", borderRadius: 8, background: C.greenSoft, fontSize: 13, color: C.green, marginBottom: 12 }}>✅ Employee acknowledged all sections</div>}
      {doc.kind === "checklist" && (
        <div style={{ marginBottom: 12 }}>{(body.items || []).map(item => {
          const ticked = !!sub.answers?.items?.[item.id];
          return <div key={item.id} style={{ padding: "6px 10px", fontSize: 12, color: ticked ? C.green : C.red, display: "flex", gap: 6, alignItems: "center" }}>{ticked ? "✅" : "❌"} {item.text}</div>;
        })}</div>
      )}
      {doc.kind === "questionnaire" && (
        <div style={{ marginBottom: 12 }}>{(body.questions || []).map(q => {
          const val = sub.answers?.[q.id]?.value;
          const flagged = q.flag_on && val === q.flag_on;
          return <div key={q.id} style={{ padding: "8px 10px", fontSize: 12, color: flagged ? C.red : C.text, background: flagged ? C.redSoft : "transparent", borderRadius: 6, marginBottom: 4 }}>{q.text}: <strong>{val || "—"}</strong></div>;
        })}</div>
      )}

      {sub.signature_png && <div style={{ marginBottom: 16 }}><div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>Employee Signature</div><img src={sub.signature_png} alt="Sig" style={{ maxWidth: 300, borderRadius: 8, border: `1px solid ${C.border}`, background: C.surfaceAlt }} /></div>}

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", marginBottom: 5 }}>Manager Notes</div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surfaceAlt, color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit", resize: "vertical" }} placeholder="Add notes if needed..." />
      </div>

      <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", marginBottom: 5 }}>Manager Countersignature</div>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", background: C.surfaceAlt, marginBottom: 12, position: "relative" }}>
        <canvas ref={canvasRef} width={320} height={100} style={{ display: "block", width: "100%", height: 100, cursor: "crosshair", touchAction: "none" }} onMouseDown={sd} onMouseMove={mv} onMouseUp={ed} onMouseLeave={ed} onTouchStart={sd} onTouchMove={mv} onTouchEnd={ed} />
        {!hasDrawn && <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", color: C.textDim, fontSize: 12, pointerEvents: "none" }}>Countersign here</div>}
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={() => onReject(notes)} style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: C.redSoft, color: C.red, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Reject</button>
        <button onClick={() => { if (!hasDrawn) return; onApprove(notes, canvasRef.current.toDataURL("image/png")); }} style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: C.green, color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: hasDrawn ? 1 : 0.4 }}>Approve & Countersign</button>
      </div>
    </div>
  );
}

// ═══════ MAIN APP ═══════
export default function App() {
  const { emps, setEmps, saveEmp, deleteEmp, loaded: eL, refresh: refreshEmps } = useEmployees();
  const { docs, setDocs, saveDoc, deleteDoc, loaded: dL, refresh: refreshDocs } = useDocs();
  const { managerPin, loaded: sL } = useSettings();
  const { obDocs, loaded: obDL, refresh: refreshObDocs } = useOnboardingDocs();
  const { subs: obSubs, loaded: obSL, saveSub: saveObSub, refresh: refreshObSubs } = useOnboardingSubs();
  const [lang, setLang] = useLang();

  const [auth, setAuth] = useState(null);
  const [pin, setPin] = useState(""); const [loginUser, setLoginUser] = useState(""); const [lErr, setLErr] = useState("");
  const [view, setView] = useState("dashboard"); const [selId, setSelId] = useState(null);
  const [search, setSearch] = useState(""); const [sigDocId, setSigDocId] = useState(null); const [viewSig, setViewSig] = useState(null);
  const [showAE, setShowAE] = useState(false); const [showAD, setShowAD] = useState(false); const [showAP, setShowAP] = useState(false); const [showAssign, setShowAssign] = useState(null);
  const [nN, sNN] = useState(""); const [nR, sNR] = useState(""); const [nP, sNP] = useState(""); const [nSD, sNSD] = useState(todayDate()); const [nTP, sNTP] = useState(true); const [nUN, sNUN] = useState(""); const [nRole, sNRole] = useState("employee");
  const [nDN, sNDN] = useState(""); const [nDT, sNDT] = useState("sop"); const [nDU, sNDU] = useState(""); const [nDC, sNDC] = useState("");
  const [nPR, sNPR] = useState(""); const [nPD, sNPD] = useState(todayDate()); const [nPW, sNPW] = useState("");
  const [obOpenDocId, setObOpenDocId] = useState(null); const [obReviewId, setObReviewId] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  // Auto-refresh data every 30 seconds so changes show up across devices
  useEffect(() => {
    const interval = setInterval(() => { refreshEmps(); refreshDocs(); refreshObSubs(); }, 30000);
    return () => clearInterval(interval);
  }, [refreshEmps, refreshDocs, refreshObSubs]);

  const t = T[lang] || T.en;
  const loaded = eL && dL && sL && obDL && obSL;
  const isEmp = auth?.role === "employee";
  const empSelf = isEmp ? emps.find(e => e.id === auth.id) : null;
  const sel = emps.find(e => e.id === selId);
  const authUser = auth ? emps.find(e => e.id === auth.id) : null;

  const login = () => {
    setLErr("");
    const trimUser = loginUser.trim().toLowerCase();
    if (!trimUser || !pin) { setLErr(t.pinError); return; }
    const e = emps.find(e => (e.username || "").toLowerCase() === trimUser && e.pin === pin);
    if (e) {
      setAuth({ role: e.accountType || "employee", id: e.id });
      setPin(""); setLoginUser(""); return;
    }
    setLErr(t.pinError);
  };
  const isManager = auth?.role === "manager";
  const isSupervisor = auth?.role === "supervisor";
  const isAdmin = isManager || isSupervisor;

  const updE = useCallback((id, updates) => {
    setEmps(prev => {
      const next = prev.map(e => e.id === id ? { ...e, ...updates } : e);
      const updated = next.find(e => e.id === id);
      if (updated) saveEmp(updated);
      return next;
    });
  }, [setEmps, saveEmp]);

  const addE = async () => {
    if (!nN.trim() || !nP.trim()) return;
    const emp = { id: "e" + Date.now(), name: nN.trim(), role: nR.trim() || "Team Member", pin: nP.trim(), username: nUN.trim().toLowerCase(), accountType: nRole, startDate: nSD, pickHistory: [], docChecks: {}, notes: "", privateNotes: "", trackPickRate: nTP };
    await saveEmp(emp); sNN(""); sNR(""); sNP(""); sNSD(todayDate()); sNTP(true); sNUN(""); sNRole("employee"); setShowAE(false);
  };
  const remE = async (id) => { await deleteEmp(id); if (selId === id) { setSelId(null); setView("employees"); } };
  const addD = async () => {
    if (!nDN.trim()) return;
    const doc = { id: "d" + Date.now(), name: nDN.trim(), type: nDT, url: nDU.trim(), assignedTo: ["all"], contractText: nDT === "contract" ? nDC : "" };
    await saveDoc(doc); sNDN(""); sNDT("sop"); sNDU(""); sNDC(""); setShowAD(false);
  };
  const remD = async (did) => {
    await deleteDoc(did);
    // Also clean up doc references in employees
    emps.forEach(async (e) => { if (e.docChecks[did]) { const nc = { ...e.docChecks }; delete nc[did]; await saveEmp({ ...e, docChecks: nc }); } });
    refreshEmps();
  };
  const toggleAssign = async (docId, empId) => {
    const doc = docs.find(d => d.id === docId); if (!doc) return;
    let a = [...(doc.assignedTo || [])];
    if (empId === "all") { a = a.includes("all") ? [] : ["all"]; }
    else { a = a.filter(x => x !== "all"); if (a.includes(empId)) a = a.filter(x => x !== empId); else a.push(empId); }
    await saveDoc({ ...doc, assignedTo: a });
  };
  const addPk = async () => {
    const r = parseInt(nPR); const w = parseInt(nPW);
    if (isNaN(r) || r < 0 || r > 100 || !selId || isNaN(w) || w < 1) return;
    const emp = emps.find(e => e.id === selId); if (!emp) return;
    await saveEmp({ ...emp, pickHistory: [...emp.pickHistory, { date: nPD, wk: w, rate: r }].sort((a, b) => a.date.localeCompare(b.date)) });
    sNPR(""); sNPD(todayDate()); sNPW(""); setShowAP(false);
  };
  const reviewSOP = async (empId, docId) => {
    const emp = emps.find(e => e.id === empId); if (!emp) return;
    await saveEmp({ ...emp, docChecks: { ...emp.docChecks, [docId]: { date: todayDate(), dateTime: nowDateTime(), sig: null, signedBy: emp.name } } });
  };
  const signContract = async (empId, docId, sigData, typedName) => {
    const emp = emps.find(e => e.id === empId); if (!emp) return;
    await saveEmp({ ...emp, docChecks: { ...emp.docChecks, [docId]: { date: todayDate(), dateTime: nowDateTime(), sig: sigData, signedBy: emp.name, typedName } } });
    setSigDocId(null);
  };
  // Contract: employee opens Adobe link → auto-mark as "opened"
  const openContractLink = async (empId, docId, url) => {
    const emp = emps.find(e => e.id === empId); if (!emp) return;
    if (!emp.docChecks[docId]) {
      await saveEmp({ ...emp, docChecks: { ...emp.docChecks, [docId]: { date: todayDate(), dateTime: nowDateTime(), sig: null, signedBy: emp.name, status: "opened" } } });
    }
    window.open(url, "_blank");
  };
  // Manager marks contract as signed (after confirming in Adobe)
  const markContractSigned = async (empId, docId) => {
    const emp = emps.find(e => e.id === empId); if (!emp) return;
    const existing = emp.docChecks[docId] || {};
    await saveEmp({ ...emp, docChecks: { ...emp.docChecks, [docId]: { ...existing, date: existing.date || todayDate(), dateTime: existing.dateTime || nowDateTime(), signedBy: existing.signedBy || emp.name, status: "signed", signedConfirmedAt: nowDateTime() } } });
  };

  // Onboarding functions
  const submitOnboardingDoc = async (empId, docId, answers, sigPng) => {
    const doc = obDocs.find(d => d.id === docId);
    const flags = doc ? computeFlags(doc, answers) : [];
    const status = flags.length > 0 ? "flagged" : "submitted";
    await saveObSub({
      id: `ob_${empId}_${docId}`,
      employee_id: empId,
      document_id: docId,
      answers,
      signature_png: sigPng,
      status,
      flag_reasons: flags,
      submitted_at: new Date().toISOString()
    });
    setObOpenDocId(null);
  };

  const approveOnboardingSub = async (subId, notes, mgrSigPng) => {
    const sub = obSubs.find(s => s.id === subId);
    if (!sub) return;
    await saveObSub({ ...sub, status: "approved", manager_notes: notes, manager_signature_png: mgrSigPng, reviewed_at: new Date().toISOString(), reviewed_by: "manager" });
    setObReviewId(null);
  };

  const rejectOnboardingSub = async (subId, notes) => {
    const sub = obSubs.find(s => s.id === subId);
    if (!sub) return;
    await saveObSub({ ...sub, status: "rejected", manager_notes: notes, reviewed_at: new Date().toISOString(), reviewed_by: "manager" });
    setObReviewId(null);
  };

  const getEmpObProgress = (empId) => {
    if (!obDocs.length) return { total: 0, done: 0, pct: 0, hasFlagged: false };
    const empSubs = obSubs.filter(s => s.employee_id === empId);
    const approved = empSubs.filter(s => s.status === "approved").length;
    const flagged = empSubs.some(s => s.status === "flagged");
    return { total: obDocs.length, done: approved, pct: Math.round((approved / obDocs.length) * 100), hasFlagged: flagged };
  };

  const nb = a => ({ padding: "9px 16px", borderRadius: 8, border: "none", background: a ? C.accentSoft : "transparent", color: a ? C.accent : C.textMuted, fontWeight: 600, fontSize: 13, cursor: "pointer" });
  const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24 };
  const inp = { width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surfaceAlt, color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
  const lbl = { display: "block", fontSize: 11, color: C.textMuted, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 };

  const EmpDocItem = ({ doc, emp, isMgr }) => {
    const chk = emp.docChecks[doc.id]; const done = !!chk;
    const isContract = doc.type === "contract";
    const [confirmCheck, setConfirmCheck] = useState(false);
    const contractStatus = chk?.status; // "opened" or "signed"
    const isOpened = contractStatus === "opened";
    const isSigned = contractStatus === "signed";
    // For contracts: done means at least opened. For SOPs: done means reviewed.
    const fullyDone = isContract ? isSigned : done;
    const bgColor = fullyDone ? C.greenSoft : (isOpened ? C.amberSoft : C.surfaceAlt);
    const borderColor = fullyDone ? "rgba(34,197,94,0.18)" : (isOpened ? "rgba(234,179,8,0.18)" : C.border);
    return (
      <div style={{ padding: "12px 14px", borderRadius: 10, background: bgColor, border: `1px solid ${borderColor}`, marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: confirmCheck ? 12 : 0, flexWrap: "wrap", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>{isSigned ? "✅" : isOpened ? "📨" : isContract ? "📝" : done ? "✅" : "📄"}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: fullyDone ? C.green : (isOpened ? C.amber : C.text) }}>{doc.name}</div>
              {isContract && chk && <div style={{ fontSize: 10, color: C.textMuted, fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
                {isSigned ? <>✅ {t.signed} · {t.confirmedAt || "Confirmed"} {chk.signedConfirmedAt || chk.dateTime}</> :
                 isOpened ? <>📨 {t.opened || "Opened"} {chk.dateTime} · {t.awaitingSignature || "Awaiting signature"}</> : null}
              </div>}
              {!isContract && done && <div style={{ fontSize: 10, color: C.textMuted, fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
                {t.reviewedAt} {chk.dateTime || chk.date}
              </div>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {/* SOP: View Doc link (no auto-tracking) */}
            {!isContract && doc.url && <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${C.border}`, color: C.accent, fontWeight: 600, fontSize: 11, textDecoration: "none" }}>{t.viewDoc}</a>}
            {/* Contract: Open Document button (auto-marks as opened for employees) */}
            {isContract && doc.url && !isMgr && <button onClick={() => openContractLink(emp.id, doc.id, doc.url)} style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${C.border}`, background: "transparent", color: C.accent, fontWeight: 600, fontSize: 11, cursor: "pointer" }}>{t.openDocument || "Open Document"}</button>}
            {/* Contract: Manager view doc link */}
            {isContract && doc.url && isMgr && <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${C.border}`, color: C.accent, fontWeight: 600, fontSize: 11, textDecoration: "none" }}>{t.viewDoc}</a>}
            {/* Contract: Manager can mark as signed once opened */}
            {isContract && isOpened && isMgr && <button onClick={() => markContractSigned(emp.id, doc.id)} style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: C.green, color: "#fff", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>{t.markSigned || "Mark as Signed"}</button>}
            {/* SOP: Mark as reviewed button for employees */}
            {!isContract && !done && !confirmCheck && !isMgr && <button onClick={() => setConfirmCheck(true)} style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: C.accent, color: "#fff", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>{t.markReviewed}</button>}
            {/* Contract: Not opened yet - employee prompt */}
            {isContract && !chk && !isMgr && !doc.url && <span style={{ fontSize: 11, color: C.textDim }}>{t.noLink || "No link added"}</span>}
          </div>
        </div>
        {/* SOP checkbox confirmation */}
        {confirmCheck && !done && (<div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
          <label onClick={() => { reviewSOP(emp.id, doc.id); setConfirmCheck(false); }} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${C.accent}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}><svg width="14" height="14" viewBox="0 0 14 14" fill="none" opacity={0.3}><path d="M3 7L6 10L11 4" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
            <div><div style={{ fontSize: 13, fontWeight: 600 }}>{t.confirmReview}</div><div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{doc.name}</div></div>
          </label>
          <div style={{ textAlign: "right", marginTop: 8 }}><button onClick={() => setConfirmCheck(false)} style={{ padding: "6px 14px", borderRadius: 6, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, fontWeight: 600, fontSize: 11, cursor: "pointer" }}>{t.cancel}</button></div>
        </div>)}
      </div>
    );
  };

  if (!loaded) return <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted, fontFamily: "'DM Sans', sans-serif" }}>{t.loading || "Loading..."}</div>;

  // ═══════ LOGIN ═══════
  if (!auth) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', 'Segoe UI', sans-serif", color: C.text }}>
      <div style={{ ...card, width: 360, padding: 36, textAlign: "center", position: "relative" }}>
        <div style={{ position: "absolute", top: 16, right: 16 }}><LangSel lang={lang} setLang={setLang} /></div>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700, color: "#fff", marginBottom: 18 }}>P</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t.appName}</h1>
        <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 28 }}>{t.pinPrompt}</p>
        <input type="text" value={loginUser} onChange={e => { setLoginUser(e.target.value); setLErr(""); }} placeholder="Username" style={{ ...inp, textAlign: "center", fontSize: 15, marginBottom: 10, fontFamily: "'DM Sans', sans-serif" }} autoFocus autoComplete="username" />
        <input type="password" maxLength={8} value={pin} onChange={e => { setPin(e.target.value.replace(/\D/g, "")); setLErr(""); }} onKeyDown={e => e.key === "Enter" && login()} placeholder={t.pinPlaceholder} style={{ ...inp, textAlign: "center", fontSize: 22, letterSpacing: 8, fontFamily: "'JetBrains Mono', monospace", marginBottom: 16 }} autoComplete="current-password" />
        {lErr && <div style={{ color: C.red, fontSize: 12, marginBottom: 12 }}>{lErr}</div>}
        <button onClick={login} style={{ width: "100%", padding: "12px", borderRadius: 10, border: "none", background: C.accent, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", marginBottom: 20 }}>{t.signIn}</button>
        {emps.length === 0 && <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.6 }}>{t.manager} PIN: 0000<br/>Add employees in the manager dashboard</div>}
      </div>
    </div>
  );

  // ═══════ EMPLOYEE VIEW ═══════
  if (!isManager && !isSupervisor) {
    const empSelfView = emps.find(e => e.id === auth?.id);
    if (!empSelfView) return <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted, fontFamily: "'DM Sans', sans-serif" }}><div style={{ textAlign: "center" }}><div style={{ fontSize: 16, marginBottom: 12 }}>Account not found</div><button onClick={() => setAuth(null)} style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: C.accent, color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>{t.signOut}</button></div></div>;
    const aDocs = getAssignedDocs(docs, empSelfView.id); const sp = docPct(empSelfView.docChecks, aDocs);
    const showPick = empSelfView.trackPickRate !== false;
    const last = empSelfView.pickHistory[empSelfView.pickHistory.length - 1]; const lPick = last ? last.rate : null; const lWk = last ? last.wk : null; const lTgt = lWk ? getTarget(lWk) : 60;
    const tr = empSelfView.pickHistory.length >= 2 ? empSelfView.pickHistory[empSelfView.pickHistory.length - 1].rate - empSelfView.pickHistory[empSelfView.pickHistory.length - 2].rate : 0;
    return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
        <div style={{ borderBottom: `1px solid ${C.border}`, padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: C.surface, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}><div style={{ width: 34, height: 34, borderRadius: 9, background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff" }}>P</div><div><div style={{ fontWeight: 700, fontSize: 15 }}>{t.welcome}, {empSelfView.name.split(" ")[0]}</div><div style={{ fontSize: 11, color: C.textMuted }}>{empSelfView.role}</div></div></div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}><LangSel lang={lang} setLang={setLang} /><button onClick={() => setAuth(null)} style={{ ...nb(false), color: C.red, fontSize: 12 }}>{t.signOut}</button></div>
        </div>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px" }}>
          {showPick && <div style={{ ...card, marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
              <div><div style={lbl}>{t.latestPickRate} {lWk ? `(${t.wk} ${lWk})` : ""}</div><div style={{ display: "flex", alignItems: "baseline", gap: 10 }}><span style={{ fontSize: 42, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: lPick !== null ? (lPick >= lTgt ? C.green : C.red) : C.textDim }}>{lPick ?? "—"}</span><span style={{ fontSize: 14, color: C.textMuted }}>/ {lTgt} {t.target}</span>{tr !== 0 && <span style={{ fontSize: 13, fontWeight: 600, color: tr > 0 ? C.green : C.red }}>{tr > 0 ? "▲" : "▼"} {Math.abs(tr)}</span>}</div>{lPick !== null && <Badge color={lPick >= lTgt ? C.green : C.red} bg={lPick >= lTgt ? C.greenSoft : C.redSoft}>{lPick >= lTgt ? t.aboveTarget : t.belowTarget}</Badge>}</div>
              <div style={{ textAlign: "right" }}><div style={lbl}>{t.docProgress}</div><div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}><Ring percent={sp} size={40} stroke={4} color={sp === 100 ? C.green : sp >= 50 ? C.amber : C.red} /><span style={{ fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{sp}%</span></div></div>
            </div>
            <div style={lbl}>{t.pickRateTrend}</div><div style={{ overflowX: "auto" }}><PickChart history={empSelfView.pickHistory} width={660} height={170} t={t} /></div>
          </div>}
          {empSelfView.notes && <div style={{ ...card, marginBottom: 18 }}><div style={lbl}>{t.notesFromManager}</div><div style={{ fontSize: 13, lineHeight: 1.6, marginTop: 6 }}>{empSelfView.notes}</div></div>}
          <div style={card}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{t.docProgress}</div><div style={{ color: C.textMuted, fontSize: 12, marginBottom: 16 }}>{t.yourDocStatus}</div>
            {aDocs.length === 0 && <div style={{ color: C.textDim }}>{t.noDocsAssigned}</div>}
            {["sop", "contract"].map(type => { const td = aDocs.filter(d => d.type === type); if (!td.length) return null; return (<div key={type} style={{ marginBottom: 16 }}><div style={{ fontSize: 11, color: C.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>{type === "sop" ? t.sops : t.contracts}</div>{td.map(doc => <EmpDocItem key={doc.id} doc={doc} emp={empSelfView} isMgr={false} />)}</div>); })}
          </div>

          {/* Employee Onboarding Section */}
          {obDocs.length > 0 && (
            <div style={{ ...card, marginTop: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Onboarding Documents</div>
              <div style={{ color: C.textMuted, fontSize: 12, marginBottom: 16 }}>Complete all onboarding documents below</div>

              {obOpenDocId ? (() => {
                const doc = obDocs.find(d => d.id === obOpenDocId);
                const existing = obSubs.find(s => s.employee_id === empSelfView.id && s.document_id === obOpenDocId);
                if (!doc) return null;
                if (existing && (existing.status === "submitted" || existing.status === "flagged" || existing.status === "approved")) {
                  return (
                    <div>
                      <button onClick={() => setObOpenDocId(null)} style={{ background: "transparent", border: "none", color: C.accent, cursor: "pointer", fontSize: 13, fontWeight: 600, marginBottom: 14, padding: 0 }}>← Back</button>
                      <div style={{ padding: "16px", borderRadius: 10, background: existing.status === "approved" ? C.greenSoft : existing.status === "rejected" ? C.redSoft : C.amberSoft, textAlign: "center" }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>{existing.status === "approved" ? "✅" : existing.status === "rejected" ? "❌" : "📨"}</div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{doc.title}</div>
                        <div style={{ color: C.textMuted, fontSize: 12, marginTop: 4 }}>{existing.status === "approved" ? "Approved by manager" : existing.status === "rejected" ? "Rejected — please speak to your manager" : "Submitted — awaiting manager review"}</div>
                        {existing.manager_notes && <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: C.surfaceAlt, fontSize: 12, color: C.text }}>Manager note: {existing.manager_notes}</div>}
                      </div>
                    </div>
                  );
                }
                return <OnboardingDocView doc={doc} existing={existing} empName={empSelfView.name} t={t} onSubmit={(ans, sig) => submitOnboardingDoc(empSelfView.id, doc.id, ans, sig)} onCancel={() => setObOpenDocId(null)} />;
              })() : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {obDocs.map(doc => {
                    const sub = obSubs.find(s => s.employee_id === empSelfView.id && s.document_id === doc.id);
                    const st = sub?.status;
                    const icon = st === "approved" ? "✅" : st === "flagged" ? "⚠️" : st === "submitted" ? "📨" : st === "rejected" ? "❌" : "📋";
                    const bg = st === "approved" ? C.greenSoft : st === "flagged" || st === "submitted" ? C.amberSoft : st === "rejected" ? C.redSoft : C.surfaceAlt;
                    const borderCol = st === "approved" ? "rgba(34,197,94,0.18)" : st === "rejected" ? "rgba(239,68,68,0.18)" : C.border;
                    const canOpen = !st || st === "draft" || st === "rejected";
                    return (
                      <div key={doc.id} onClick={() => setObOpenDocId(doc.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 10, background: bg, border: `1px solid ${borderCol}`, cursor: "pointer" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 18 }}>{icon}</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: st === "approved" ? C.green : C.text }}>{doc.title}</div>
                            <div style={{ fontSize: 10, color: C.textMuted }}>{doc.kind === "acknowledge" ? "Read & acknowledge" : doc.kind === "checklist" ? "Training checklist" : "Questionnaire"}{st ? ` · ${st}` : ""}</div>
                          </div>
                        </div>
                        {canOpen && <span style={{ color: C.accent, fontSize: 12, fontWeight: 600 }}>Open →</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        {viewSig && <Modal onClose={() => setViewSig(null)}><h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{t.signature}</h3><img src={viewSig} alt="Sig" style={{ width: "100%", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surfaceAlt }} /><div style={{ textAlign: "right", marginTop: 12 }}><button onClick={() => setViewSig(null)} style={{ padding: "8px 18px", borderRadius: 7, border: "none", background: C.accent, color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>{t.close}</button></div></Modal>}
      </div>
    );
  }

  // ═══════ MANAGER VIEW ═══════
  const activeEmps = emps.filter(e => !e.archived);
  const displayEmps = showArchived ? emps : activeEmps;
  const pickEmps = activeEmps.filter(e => e.trackPickRate !== false);
  const avgPick = pickEmps.length ? Math.round(pickEmps.reduce((s, e) => s + (e.pickHistory.length ? e.pickHistory[e.pickHistory.length - 1].rate : 0), 0) / pickEmps.length) : 0;
  const avgDoc = activeEmps.length ? Math.round(activeEmps.reduce((s, e) => s + docPct(e.docChecks, getAssignedDocs(docs, e.id)), 0) / activeEmps.length) : 0;
  const fullC = activeEmps.filter(e => docPct(e.docChecks, getAssignedDocs(docs, e.id)) === 100).length;
  const needA = activeEmps.filter(e => { const last = e.pickHistory[e.pickHistory.length - 1]; if (!last) return true; return last.rate < getTarget(last.wk) || docPct(e.docChecks, getAssignedDocs(docs, e.id)) < 40; }).length;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans', 'Segoe UI', sans-serif", fontSize: 14, lineHeight: 1.55 }}>
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: C.surface, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}><div style={{ width: 34, height: 34, borderRadius: 9, background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff" }}>P</div><div><div style={{ fontWeight: 700, fontSize: 15 }}>{t.appName}</div><div style={{ fontSize: 11, color: C.textMuted }}>{isManager ? t.managerView : "Supervisor View"}{authUser ? ` · ${authUser.name}` : ""}</div></div></div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <button style={nb(view === "dashboard")} onClick={() => setView("dashboard")}>{t.dashboard}</button>
          <button style={nb(view === "employees" || view === "detail")} onClick={() => setView("employees")}>{t.employees}</button>
          {isManager && <button style={nb(view === "documents")} onClick={() => setView("documents")}>{t.documents}</button>}
          <button style={nb(view === "onboarding")} onClick={() => setView("onboarding")}>Onboarding</button>
          {isManager && <button onClick={() => exportXLS(emps, docs, t)} style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: "rgba(34,197,94,0.15)", color: C.green, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>📊 {t.exportExcel}</button>}
          <div style={{ width: 1, height: 24, background: C.border, margin: "0 4px" }} /><LangSel lang={lang} setLang={setLang} />
          <button onClick={() => setAuth(null)} style={{ ...nb(false), color: C.red, fontSize: 12 }}>{t.signOut}</button>
        </div>
      </div>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "28px 20px" }}>

        {view === "dashboard" && (<div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t.dashboard}</h2><p style={{ color: C.textMuted, marginBottom: 24, fontSize: 13 }}>{t.dashDesc}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14, marginBottom: 28 }}>
            {[{ l: t.employees, v: activeEmps.length, c: C.accent },{ l: t.avgPickRate, v: avgPick, c: C.amber },{ l: t.avgDocCompliance, v: `${avgDoc}%`, c: C.green },{ l: t.fullyCompliant, v: fullC, c: C.green },{ l: t.needsAttention, v: needA, c: C.red }].map((s, i) => (<div key={i} style={{ ...card, padding: 16, borderLeft: `3px solid ${s.c}` }}><div style={{ ...lbl, marginBottom: 6 }}>{s.l}</div><div style={{ fontSize: 26, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: s.c }}>{s.v}</div></div>))}
          </div>
          <div style={{ ...card, padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, fontWeight: 600, fontSize: 13 }}>{t.teamOverview}</div>
            <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>{[t.employee, t.role, `${t.pickRate}/${t.target}`, t.trend, t.docProgress, t.status].map(h => (<th key={h} style={{ textAlign: "left", padding: "10px 14px", ...lbl, marginBottom: 0 }}>{h}</th>))}</tr></thead>
              <tbody>{displayEmps.map(emp => { const ad = getAssignedDocs(docs, emp.id); const dp = docPct(emp.docChecks, ad); const last = emp.pickHistory[emp.pickHistory.length - 1]; const lp = last ? last.rate : 0; const tgt = getTarget(last ? last.wk : 0); const met = lp >= tgt; const tr = emp.pickHistory.length >= 2 ? emp.pickHistory[emp.pickHistory.length - 1].rate - emp.pickHistory[emp.pickHistory.length - 2].rate : 0;
                return (<tr key={emp.id} onClick={() => { setSelId(emp.id); setView("detail"); }} style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "11px 14px", fontWeight: 600 }}>{emp.name}</td><td style={{ padding: "11px 14px", color: C.textMuted }}>{emp.role}</td>
                  <td style={{ padding: "11px 14px" }}><span style={{ color: met ? C.green : C.red, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{lp}</span><span style={{ color: C.textDim, fontSize: 12 }}>/{tgt}</span></td>
                  <td style={{ padding: "11px 14px" }}>{tr !== 0 ? <span style={{ fontSize: 12, fontWeight: 600, color: tr > 0 ? C.green : C.red }}>{tr > 0 ? "▲" : "▼"}{Math.abs(tr)}</span> : <span style={{ color: C.textDim }}>—</span>}</td>
                  <td style={{ padding: "11px 14px" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ flex: 1, maxWidth: 100, height: 5, background: C.border, borderRadius: 99, overflow: "hidden" }}><div style={{ width: `${dp}%`, height: "100%", background: dp === 100 ? C.green : dp >= 50 ? C.amber : C.red, borderRadius: 99 }} /></div><span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.textMuted }}>{dp}%</span></div></td>
                  <td style={{ padding: "11px 14px" }}>{dp === 100 && met ? <Badge color={C.green} bg={C.greenSoft}>{t.excellent}</Badge> : !met || dp < 40 ? <Badge color={C.red} bg={C.redSoft}>{t.attention}</Badge> : <Badge color={C.amber} bg={C.amberSoft}>{t.inProgress}</Badge>}</td>
                </tr>); })}</tbody>
            </table></div>
          </div>
        </div>)}

        {view === "employees" && (<div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            <div><h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t.employees}</h2><p style={{ color: C.textMuted, fontSize: 13 }}>{activeEmps.length} {t.teamMembers}{emps.length !== activeEmps.length ? ` · ${emps.length - activeEmps.length} archived` : ""}</p></div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}><input placeholder={t.search} value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, width: 170 }} />{isManager && <button onClick={() => setShowArchived(!showArchived)} style={{ padding: "7px 12px", borderRadius: 7, border: `1px solid ${C.border}`, background: showArchived ? C.amberSoft : "transparent", color: showArchived ? C.amber : C.textDim, fontWeight: 600, fontSize: 11, cursor: "pointer" }}>{showArchived ? "Hide Archived" : "Show Archived"}</button>}{isManager && <button onClick={() => setShowAE(true)} style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: C.accent, color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>{t.add}</button>}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(275px, 1fr))", gap: 14 }}>
            {displayEmps.filter(e => e.name.toLowerCase().includes(search.toLowerCase()) || e.role.toLowerCase().includes(search.toLowerCase())).map(emp => { const ad = getAssignedDocs(docs, emp.id); const dp = docPct(emp.docChecks, ad); const last = emp.pickHistory[emp.pickHistory.length - 1]; const lp = last ? last.rate : 0; const tgt = getTarget(last ? last.wk : 0); const met = lp >= tgt;
              return (<div key={emp.id} onClick={() => { setSelId(emp.id); setView("detail"); }} style={{ ...card, cursor: "pointer", transition: "border-color 0.2s", opacity: emp.archived ? 0.5 : 1 }} onMouseEnter={e => e.currentTarget.style.borderColor = C.accent} onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><div><div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{emp.name}{emp.archived ? " (Archived)" : ""}</div><div style={{ color: C.textMuted, fontSize: 12 }}>{emp.role}</div></div><Ring percent={dp} size={42} stroke={4} color={dp === 100 ? C.green : dp >= 50 ? C.amber : C.red} /></div>
                <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between" }}><div><span style={{ fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: met ? C.green : C.red }}>{lp}</span><span style={{ fontSize: 11, color: C.textDim }}>/{tgt}</span></div><span style={{ fontSize: 11, color: C.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>{dp}%</span></div>
              </div>); })}
          </div>
          {showAE && <Modal onClose={() => setShowAE(false)}><h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 18 }}>{t.addEmployee}</h3>
            {[{ l: t.fullName, v: nN, s: sNN, p: "e.g. Jane Smith" },{ l: "Username", v: nUN, s: sNUN, p: "e.g. jsmith" },{ l: t.role, v: nR, s: sNR, p: "e.g. Warehouse Operative" },{ l: t.pinForSignIn, v: nP, s: v => sNP(v.replace(/\D/g, "")), p: "e.g. 7777" }].map(f => (<div key={f.l} style={{ marginBottom: 12 }}><label style={lbl}>{f.l}</label><input value={f.v} onChange={e => f.s(e.target.value)} placeholder={f.p} style={inp} /></div>))}
            <div style={{ marginBottom: 12 }}><label style={lbl}>Account Type</label><div style={{ display: "flex", gap: 8 }}>{["employee", "supervisor", "manager"].map(r => (<button key={r} onClick={() => sNRole(r)} style={{ flex: 1, padding: "9px", borderRadius: 8, border: `1px solid ${nRole === r ? C.accent : C.border}`, background: nRole === r ? C.accentSoft : "transparent", color: nRole === r ? C.accent : C.textMuted, fontWeight: 600, fontSize: 12, cursor: "pointer", textTransform: "capitalize" }}>{r}</button>))}</div></div>
            <div style={{ marginBottom: 12 }}><label style={lbl}>{t.startDate}</label><input type="date" value={nSD} onChange={e => sNSD(e.target.value)} style={inp} /></div>
            <div style={{ marginBottom: 16 }}><label onClick={() => sNTP(!nTP)} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "10px 12px", borderRadius: 8, background: nTP ? C.accentSoft : C.surfaceAlt, border: `1px solid ${nTP ? C.accent : C.border}` }}><div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${nTP ? C.accent : C.textDim}`, background: nTP ? C.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{nTP && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}</div><span style={{ fontWeight: 600, fontSize: 13, color: nTP ? C.accent : C.textMuted }}>{t.trackPickRate || "Track Pick Rate"}</span></label></div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}><button onClick={() => setShowAE(false)} style={{ padding: "9px 18px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>{t.cancel}</button><button onClick={addE} style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: C.accent, color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: nN.trim() && nP.trim() ? 1 : 0.4 }}>{t.add}</button></div>
          </Modal>}
        </div>)}

        {view === "documents" && (<div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            <div><h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{t.documents}</h2><p style={{ color: C.textMuted, fontSize: 13 }}>{t.docManageDesc}</p></div>
            <button onClick={() => setShowAD(true)} style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: C.accent, color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>{t.addDocument}</button>
          </div>
          {["sop", "contract"].map(type => { const td = docs.filter(d => d.type === type); if (!td.length) return null; return (<div key={type} style={{ marginBottom: 24 }}><div style={{ ...lbl, marginBottom: 10, fontSize: 12 }}>{type === "sop" ? t.sops : t.contracts}</div><div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{td.map(doc => { const aEmps = emps.filter(e => doc.assignedTo?.includes("all") || doc.assignedTo?.includes(e.id)); const sc = aEmps.filter(e => e.docChecks[doc.id]).length; return (<div key={doc.id} style={{ ...card, padding: "14px 18px" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}><div style={{ flex: 1, minWidth: 200 }}><div style={{ fontWeight: 600, fontSize: 14 }}>{doc.type === "contract" ? "📝" : "📄"} {doc.name}</div><div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>{sc}/{aEmps.length} {doc.type === "contract" ? t.signed : t.reviewed}{doc.contractText ? " · 📋" : ""}{doc.url && <> · <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ color: C.accent, textDecoration: "none" }}>{t.viewDoc}↗</a></>}</div></div><div style={{ display: "flex", gap: 6 }}><button onClick={() => setShowAssign(doc.id)} style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${C.border}`, background: "transparent", color: C.accent, fontWeight: 600, fontSize: 11, cursor: "pointer" }}>{t.assignDocs}</button><button onClick={() => { if (window.confirm(`${t.remove} "${doc.name}"?`)) remD(doc.id); }} style={{ background: C.redSoft, border: "none", color: C.red, padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{t.remove}</button></div></div><div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>{aEmps.map(emp => { const chk = emp.docChecks[doc.id]; const st = chk?.status; const isSigned = st === "signed"; const isOpened = st === "opened"; const chipBg = isSigned ? C.greenSoft : (isOpened ? C.amberSoft : (chk ? C.greenSoft : C.redSoft)); const chipColor = isSigned ? C.green : (isOpened ? C.amber : (chk ? C.green : C.red)); const chipIcon = isSigned ? "✓" : (isOpened ? "◎" : (chk ? "✓" : "✗")); return (<div key={emp.id} style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: chipBg, color: chipColor }}>{emp.name.split(" ")[0]} {chipIcon}</div>); })}</div></div>); })}</div></div>); })}
          {showAssign && (() => { const doc = docs.find(d => d.id === showAssign); if (!doc) return null; const isAll = doc.assignedTo?.includes("all"); return (<Modal onClose={() => setShowAssign(null)}><h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>{t.assignDocs}</h3><div style={{ color: C.textMuted, fontSize: 13, marginBottom: 18 }}>{doc.name}</div><div style={{ marginBottom: 12 }}><label onClick={() => toggleAssign(doc.id, "all")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, background: isAll ? C.accentSoft : C.surfaceAlt, border: `1px solid ${isAll ? C.accent : C.border}`, cursor: "pointer", marginBottom: 8 }}><div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${isAll ? C.accent : C.textDim}`, background: isAll ? C.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{isAll && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}</div><span style={{ fontWeight: 600, fontSize: 13, color: isAll ? C.accent : C.text }}>{t.allEmployees}</span></label>{!isAll && emps.map(emp => { const assigned = doc.assignedTo?.includes(emp.id); return (<label key={emp.id} onClick={() => toggleAssign(doc.id, emp.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: assigned ? C.greenSoft : C.surfaceAlt, border: `1px solid ${assigned ? "rgba(34,197,94,0.18)" : C.border}`, cursor: "pointer", marginBottom: 5 }}><div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${assigned ? C.green : C.textDim}`, background: assigned ? C.green : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{assigned && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}</div><div><div style={{ fontWeight: 600, fontSize: 13 }}>{emp.name}</div><div style={{ fontSize: 11, color: C.textMuted }}>{emp.role}</div></div></label>); })}</div><div style={{ textAlign: "right" }}><button onClick={() => setShowAssign(null)} style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: C.accent, color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>{t.close}</button></div></Modal>); })()}
          {showAD && <Modal onClose={() => setShowAD(false)} wide={nDT === "contract"}><h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 18 }}>{t.addDocument}</h3>
            <div style={{ marginBottom: 12 }}><label style={lbl}>{t.docName}</label><input value={nDN} onChange={e => sNDN(e.target.value)} placeholder="e.g. Employment Contract" style={inp} /></div>
            <div style={{ marginBottom: 12 }}><label style={lbl}>{t.type}</label><div style={{ display: "flex", gap: 8 }}>{["sop", "contract"].map(ty => (<button key={ty} onClick={() => sNDT(ty)} style={{ flex: 1, padding: "9px", borderRadius: 8, border: `1px solid ${nDT === ty ? C.accent : C.border}`, background: nDT === ty ? C.accentSoft : "transparent", color: nDT === ty ? C.accent : C.textMuted, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>{ty === "sop" ? t.sop : t.contract}</button>))}</div></div>
            <div style={{ marginBottom: 12 }}><label style={lbl}>{t.linkToDoc}</label><input value={nDU} onChange={e => sNDU(e.target.value)} placeholder="https://drive.google.com/..." style={inp} /><div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>{t.linkHint}</div></div>
            {nDT === "contract" && <div style={{ marginBottom: 12 }}><label style={lbl}>{t.contractText}</label><textarea value={nDC} onChange={e => sNDC(e.target.value)} placeholder="Paste the full contract wording here..." rows={10} style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} /><div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>{t.contractTextHint}</div></div>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}><button onClick={() => setShowAD(false)} style={{ padding: "9px 18px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>{t.cancel}</button><button onClick={addD} style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: C.accent, color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: nDN.trim() ? 1 : 0.4 }}>{t.add}</button></div>
          </Modal>}
        </div>)}

        {/* ═══ ONBOARDING (Manager) ═══ */}
        {view === "onboarding" && (<div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Onboarding</h2>
          <p style={{ color: C.textMuted, marginBottom: 24, fontSize: 13 }}>Track new employee onboarding progress and review submissions</p>

          {/* Review queue - flagged/submitted items */}
          {(() => {
            const pendingSubs = obSubs.filter(s => s.status === "flagged" || s.status === "submitted");
            if (pendingSubs.length > 0 && !obReviewId) return (
              <div style={{ ...card, marginBottom: 20, borderLeft: `3px solid ${C.amber}` }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>📋 Pending Reviews ({pendingSubs.length})</div>
                {pendingSubs.map(sub => {
                  const doc = obDocs.find(d => d.id === sub.document_id);
                  const emp = emps.find(e => e.id === sub.employee_id);
                  return (
                    <div key={sub.id} onClick={() => setObReviewId(sub.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 8, background: sub.status === "flagged" ? C.redSoft : C.surfaceAlt, border: `1px solid ${sub.status === "flagged" ? "rgba(239,68,68,0.2)" : C.border}`, marginBottom: 6, cursor: "pointer" }}>
                      <div><div style={{ fontWeight: 600, fontSize: 13 }}>{emp?.name || "Unknown"}</div><div style={{ fontSize: 11, color: C.textMuted }}>{doc?.title || "Unknown document"}</div></div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {sub.status === "flagged" && <span style={{ padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700, background: C.redSoft, color: C.red }}>⚠ {sub.flag_reasons?.length || 0} flags</span>}
                        <span style={{ color: C.textDim }}>›</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
            return null;
          })()}

          {/* Review detail */}
          {obReviewId && (() => {
            const sub = obSubs.find(s => s.id === obReviewId);
            if (!sub) return null;
            const doc = obDocs.find(d => d.id === sub.document_id);
            const emp = emps.find(e => e.id === sub.employee_id);
            if (!doc) return null;
            return (
              <div style={card}>
                <ManagerReviewDetail sub={sub} doc={doc} empName={emp?.name || "Unknown"} t={t} onBack={() => setObReviewId(null)} onApprove={(notes, sig) => approveOnboardingSub(sub.id, notes, sig)} onReject={(notes) => rejectOnboardingSub(sub.id, notes)} />
              </div>
            );
          })()}

          {/* Employee onboarding progress */}
          {!obReviewId && (
            <div style={{ ...card, padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, fontWeight: 600, fontSize: 13 }}>Employee Onboarding Progress</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600 }}>Employee</th>
                    {obDocs.map(d => <th key={d.id} style={{ textAlign: "center", padding: "10px 8px", fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, maxWidth: 100 }}>{d.title.length > 20 ? d.title.slice(0, 18) + "…" : d.title}</th>)}
                    <th style={{ textAlign: "center", padding: "10px 14px", fontSize: 11, color: C.textMuted, textTransform: "uppercase", fontWeight: 600 }}>Progress</th>
                  </tr></thead>
                  <tbody>{emps.map(emp => {
                    const prog = getEmpObProgress(emp.id);
                    return (
                      <tr key={emp.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: "10px 14px", fontWeight: 600, fontSize: 13 }}>{emp.name}<div style={{ fontSize: 11, color: C.textMuted }}>{emp.role}</div></td>
                        {obDocs.map(d => {
                          const sub = obSubs.find(s => s.employee_id === emp.id && s.document_id === d.id);
                          const st = sub?.status;
                          const icon = st === "approved" ? "✅" : st === "flagged" ? "⚠️" : st === "submitted" ? "📨" : st === "rejected" ? "❌" : "⬜";
                          const bgCol = st === "approved" ? C.greenSoft : st === "flagged" ? C.redSoft : st === "submitted" ? C.amberSoft : "transparent";
                          return <td key={d.id} style={{ textAlign: "center", padding: "6px", fontSize: 16, background: bgCol, verticalAlign: "middle" }}>
                            <div>{icon}</div>
                            {sub && (st === "approved" || st === "submitted" || st === "flagged") && <button onClick={(e) => { e.stopPropagation(); downloadOnboardingCert(d, sub, emp.name); }} style={{ marginTop: 2, padding: "2px 6px", borderRadius: 4, border: `1px solid ${C.border}`, background: "transparent", color: C.accent, fontWeight: 600, fontSize: 9, cursor: "pointer" }}>📥</button>}
                          </td>;
                        })}
                        <td style={{ textAlign: "center", padding: "10px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                            <div style={{ width: 60, height: 5, background: C.border, borderRadius: 99, overflow: "hidden" }}><div style={{ width: `${prog.pct}%`, height: "100%", background: prog.pct === 100 ? C.green : C.amber, borderRadius: 99 }} /></div>
                            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: prog.pct === 100 ? C.green : C.textMuted }}>{prog.done}/{prog.total}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            </div>
          )}
        </div>)}

        {view === "detail" && sel && (() => {
          const ad = getAssignedDocs(docs, sel.id); const dp = docPct(sel.docChecks, ad);
          const showPick = sel.trackPickRate !== false;
          return (<div>
            <button onClick={() => setView("employees")} style={{ background: "transparent", border: "none", color: C.accent, cursor: "pointer", fontSize: 13, fontWeight: 600, marginBottom: 18, padding: 0 }}>{t.backToEmployees}</button>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}><div><h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 2 }}>{sel.name}{sel.archived ? " (Archived)" : ""}</h2><div style={{ color: C.textMuted, fontSize: 13 }}>{sel.role}{sel.username ? ` · @${sel.username}` : ""} · {t.startDate}: {sel.startDate || "—"}</div></div><div style={{ display: "flex", gap: 8 }}>{isManager && <button onClick={async () => { await saveEmp({ ...sel, archived: !sel.archived }); }} style={{ padding: "7px 14px", borderRadius: 7, border: `1px solid ${C.border}`, background: sel.archived ? C.greenSoft : C.amberSoft, color: sel.archived ? C.green : C.amber, fontWeight: 600, fontSize: 11, cursor: "pointer" }}>{sel.archived ? "Restore" : "Archive"}</button>}{isManager && <button onClick={async () => { await saveEmp({ ...sel, trackPickRate: !showPick }); }} style={{ padding: "7px 14px", borderRadius: 7, border: `1px solid ${C.border}`, background: showPick ? C.accentSoft : "transparent", color: showPick ? C.accent : C.textDim, fontWeight: 600, fontSize: 11, cursor: "pointer" }}>{showPick ? "✓ " : ""}{t.pickRate}</button>}{isManager && <button onClick={() => { if (window.confirm(`${t.remove} ${sel.name}?`)) remE(sel.id); }} style={{ background: C.redSoft, border: "none", color: C.red, padding: "7px 16px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{t.removeEmployee}</button>}</div></div>
            <div style={{ display: "grid", gridTemplateColumns: showPick ? "1fr 1fr" : "1fr", gap: 18 }}>
              {showPick && <div style={card}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><div><div style={{ fontWeight: 700, fontSize: 15 }}>{t.pickRateHistory}</div><div style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>{t.weeklyTracking}</div></div><button onClick={() => setShowAP(true)} style={{ padding: "7px 14px", borderRadius: 7, border: "none", background: C.accent, color: "#fff", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>{t.addWeek}</button></div><div style={{ overflowX: "auto", marginBottom: 8 }}><PickChart history={sel.pickHistory} width={420} height={160} t={t} /></div>{sel.pickHistory.length > 0 && <div style={{ maxHeight: 140, overflowY: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr style={{ borderBottom: `1px solid ${C.border}` }}><th style={{ ...lbl, padding: "6px 8px", textAlign: "left" }}>{t.wk}</th><th style={{ ...lbl, padding: "6px 8px", textAlign: "left" }}>{t.week}</th><th style={{ ...lbl, padding: "6px 8px", textAlign: "right" }}>{t.rate}</th><th style={{ ...lbl, padding: "6px 8px", textAlign: "right" }}>{t.target}</th><th style={{ width: 28 }}></th></tr></thead><tbody>{[...sel.pickHistory].reverse().map((p, i) => { const tgt = getTarget(p.wk); const met = p.rate >= tgt; return (<tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}><td style={{ padding: "6px 8px", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: C.textMuted }}>{p.wk}</td><td style={{ padding: "6px 8px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.textDim }}>{p.date}</td><td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: met ? C.green : C.red }}>{p.rate}</td><td style={{ padding: "6px 8px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.targetYellow }}>{tgt}</td><td style={{ padding: "6px 4px", textAlign: "right" }}><button onClick={async () => { const newHist = sel.pickHistory.filter((_, j) => j !== sel.pickHistory.length - 1 - i); await saveEmp({ ...sel, pickHistory: newHist }); }} style={{ background: "transparent", border: "none", color: C.textDim, cursor: "pointer", fontSize: 11 }}>✕</button></td></tr>); })}</tbody></table></div>}</div>}
              <div style={card}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><div><div style={{ fontWeight: 700, fontSize: 15 }}>{t.docProgress}</div><div style={{ color: C.textMuted, fontSize: 12, marginTop: 2 }}>{t.assignedDocs}</div></div><div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}><Ring percent={dp} size={50} stroke={5} color={dp === 100 ? C.green : dp >= 50 ? C.amber : C.red} /><span style={{ position: "absolute", fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{dp}%</span></div></div>{ad.length === 0 && <div style={{ color: C.textDim }}>{t.noDocsAssigned}</div>}<div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 300, overflowY: "auto" }}>{["sop", "contract"].map(type => { const td = ad.filter(d => d.type === type); if (!td.length) return null; return (<div key={type}><div style={{ fontSize: 10, color: C.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, margin: "8px 0 6px" }}>{type === "sop" ? t.sopsDocs : t.contractsDocs}</div>{td.map(doc => <EmpDocItem key={doc.id} doc={doc} emp={sel} isMgr={true} />)}</div>); })}</div></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18 }}>
              <div style={card}><label style={lbl}>{t.managerNotes}</label><div style={{ fontSize: 11, color: C.textDim, marginBottom: 6 }}>✓ {t.employees.toLowerCase()} can see</div><textarea value={sel.notes || ""} onChange={e => updE(sel.id, { notes: e.target.value })} placeholder={t.notesPlaceholder} rows={4} style={{ ...inp, resize: "vertical", lineHeight: 1.5 }} onBlur={() => saveEmp(sel)} /></div>
              {isManager && <div style={{ ...card, borderColor: "rgba(239,68,68,0.2)" }}><label style={{ ...lbl, color: C.red }}>{t.privateNotes}</label><div style={{ fontSize: 11, color: C.textDim, marginBottom: 6 }}>🔒</div><textarea value={sel.privateNotes || ""} onChange={e => updE(sel.id, { privateNotes: e.target.value })} placeholder={t.privateNotesPlaceholder} rows={4} style={{ ...inp, resize: "vertical", lineHeight: 1.5, borderColor: "rgba(239,68,68,0.15)" }} onBlur={() => saveEmp(sel)} /></div>}
            </div>
            {showAP && <Modal onClose={() => setShowAP(false)}><h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 18 }}>{t.addPickRate}</h3><div style={{ marginBottom: 12 }}><label style={lbl}>{t.weekNumber}</label><input type="number" min="1" value={nPW} onChange={e => sNPW(e.target.value)} placeholder="e.g. 5" style={inp} />{nPW && parseInt(nPW) > 0 && <div style={{ fontSize: 11, color: C.targetYellow, marginTop: 4 }}>{t.target}: {getTarget(parseInt(nPW))}</div>}</div><div style={{ marginBottom: 12 }}><label style={lbl}>{t.weekStarting}</label><input type="date" value={nPD} onChange={e => sNPD(e.target.value)} style={inp} /></div><div style={{ marginBottom: 20 }}><label style={lbl}>{t.pickRate0100}</label><input type="number" min="0" max="100" value={nPR} onChange={e => sNPR(e.target.value)} placeholder="e.g. 45" style={inp} /></div><div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}><button onClick={() => setShowAP(false)} style={{ padding: "9px 18px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>{t.cancel}</button><button onClick={addPk} style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: C.accent, color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", opacity: nPR && nPW ? 1 : 0.4 }}>{t.add}</button></div></Modal>}
          </div>);
        })()}
      </div>
      {viewSig && <Modal onClose={() => setViewSig(null)}><h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{t.signature}</h3><img src={viewSig} alt="Sig" style={{ width: "100%", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surfaceAlt }} /><div style={{ textAlign: "right", marginTop: 12 }}><button onClick={() => setViewSig(null)} style={{ padding: "8px 18px", borderRadius: 7, border: "none", background: C.accent, color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>{t.close}</button></div></Modal>}
    </div>
  );
}
