// Table des types de SOL (sous la voiture). Chaque sol est une donnée, pas du code
// en dur : ajouter un sol (ex. OIL low-grip) = une ligne, sans toucher au domaine.
// Les OBSTACLES posés sur les tuiles vivent dans obstacles.ts.

import type { Surface, SurfaceId } from '../domain/surfaces';

export const S: Record<SurfaceId, Surface> = {
  WALL: { id: 'WALL', label: 'mur', solid: true, grip: 0, drag: 0, color: '#161b24', dot: '#161b24' },
  ROAD: { id: 'ROAD', label: 'route', solid: false, grip: 0.92, drag: 0.22, color: '#3c424e', dot: '#3c424e' },
  DIRT: { id: 'DIRT', label: 'terre', solid: false, grip: 0.6, drag: 0.3, color: '#8a5a33', dot: '#8a5a33' },
  GRAVEL: { id: 'GRAVEL', label: 'gravier', solid: false, grip: 0.4, drag: 0.38, color: '#9aa0a8', dot: '#9aa0a8' },
  // Flaque : très faible grip (ça décroche) ET drag accru (ça freine). Hazard pour
  // les effets visuels futurs (gerbe).
  WATER: { id: 'WATER', label: 'flaque', solid: false, grip: 0.18, drag: 0.45, hazard: true, color: '#2f6f8f', dot: '#2f6f8f' },
};
