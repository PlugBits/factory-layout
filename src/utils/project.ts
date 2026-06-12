import type { ProjectFile, ProjectSnapshot } from "../types";
import { languages, type Language } from "../i18n";
import { defaultFactory, defaultWalls, draftStorageKey, languageStorageKey } from "../constants/factory";

export function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;
}

export function loadDraftProject() {
  try {
    const raw = window.localStorage.getItem(draftStorageKey);
    if (!raw) return null;
    const project = JSON.parse(raw) as ProjectFile;
    if (!project.factory || !Array.isArray(project.items)) return null;
    return project;
  } catch {
    return null;
  }
}

export function loadLanguage(): Language {
  try {
    const urlLang = new URLSearchParams(window.location.search).get("lang");
    if (urlLang && languages.some((l) => l.code === urlLang)) return urlLang as Language;
    const raw = window.localStorage.getItem(languageStorageKey);
    return languages.some((language) => language.code === raw) ? raw as Language : "ja";
  } catch {
    return "ja";
  }
}

export function makeFactory(factory?: Partial<ProjectFile["factory"]>) {
  return {
    ...defaultFactory,
    ...factory,
    walls: { ...defaultWalls, ...factory?.walls }
  };
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function snapshotsEqual(left: ProjectSnapshot, right: ProjectSnapshot) {
  return JSON.stringify(left) === JSON.stringify(right);
}
