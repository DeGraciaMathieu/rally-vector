// Table des bots (adversaires IA). Donnée inerte : ajouter/retirer un profil = une
// entrée ici, sans toucher au domaine. Le `BotProfile` (forme) vit dans domain/ai.ts ;
// ici, seulement les valeurs d'équilibrage. Profils de skill nettement distincts (P2) :
// du casse-cou qui crashe au prudent qui sécurise.

import type { BotProfile } from '../domain/ai';
import type { Vec2 } from '../domain/vec2';

export const BOT_PROFILES: readonly BotProfile[] = [
  { id: 'ace', label: 'As', livery: '#f59e0b', aggression: 0.95, brakeMargin: 0.4, aimJitter: 0.04 },
  { id: 'pusher', label: 'Fonceur', livery: '#ef4444', aggression: 1.0, brakeMargin: 0.15, aimJitter: 0.1 },
  { id: 'steady', label: 'Régulier', livery: '#a78bfa', aggression: 0.82, brakeMargin: 0.55, aimJitter: 0.06 },
  { id: 'cautious', label: 'Prudent', livery: '#22d3ee', aggression: 0.7, brakeMargin: 0.7, aimJitter: 0.03 },
  { id: 'wild', label: 'Casse-cou', livery: '#f472b6', aggression: 1.0, brakeMargin: 0.05, aimJitter: 0.16 },
];

// Nombre de bots par course (tunable). On pioche les `PELOTON_SIZE` premiers profils.
export const PELOTON_SIZE = 5;

// Réglages de navigation de l'IA (pure-pursuit + freinage anticipé). Valeurs
// d'équilibrage du pilotage des bots (tunables), tenues hors de la logique.
export const AI_NAV = {
  lookaheadTiles: 2, // distance de visée pure-pursuit, en tuiles (reste collé à la ligne)
  advanceAt: 0.92, // fraction de segment atteinte avant de viser le coin suivant
  cornerBase: 0.82, // vitesse de coin tout droit (fraction de maxSpeed)
  cornerSharp: 1.25, // pénalité de vitesse selon la sévérité du virage (0..1)
  cornerMin: 0.12, // plancher de vitesse de coin (fraction de maxSpeed)
  brakePerPx: 0.28, // vitesse tolérée en plus par px restant avant le coin (freinage anticipé)
};

// Grille de départ : décalages déterministes (px monde) appliqués au départ par index
// de bot. Petits, dans le sens d'avance (+x), pour rester sur la piste ; sans collision
// les voitures peuvent se superposer, l'offset n'est que de lisibilité.
export const START_GRID: readonly Vec2[] = [
  { x: 0, y: 0 },
  { x: 14, y: -16 },
  { x: 14, y: 16 },
  { x: 30, y: -10 },
  { x: 30, y: 10 },
  { x: 46, y: 0 },
];
