// Table des types de sol. Chaque sol est une donnée, pas du code en dur :
// ajouter un obstacle = une ligne. WATER et TREE sont déjà fonctionnels ;
// il suffit de les poser sur une grille.

import type { Surface, SurfaceId } from '../domain/surfaces';

export const S: Record<SurfaceId, Surface> = {
  WALL: { id: 'WALL', label: 'mur', solid: true, grip: 0, drag: 0, color: '#161b24', dot: '#161b24' },
  ROAD: { id: 'ROAD', label: 'route', solid: false, grip: 0.92, drag: 0.22, color: '#3c424e', dot: '#3c424e' },
  DIRT: { id: 'DIRT', label: 'terre', solid: false, grip: 0.6, drag: 0.3, color: '#8a5a33', dot: '#8a5a33' },
  GRAVEL: { id: 'GRAVEL', label: 'gravier', solid: false, grip: 0.4, drag: 0.38, color: '#9aa0a8', dot: '#9aa0a8' },

  // --- Obstacles "un jour" : déjà fonctionnels, il suffit de les poser sur la grille ---
  WATER: { id: 'WATER', label: 'flaque', solid: false, grip: 0.18, drag: 0.3, color: '#2f6f8f', dot: '#2f6f8f' },
  TREE: { id: 'TREE', label: 'arbre', solid: true, grip: 0, drag: 0, color: '#1f3d22', dot: '#1f3d22' },
};
