// Types des surfaces de sol. La TABLE des valeurs vit dans data/surfaces.ts ;
// ici on ne décrit que la forme d'une donnée de surface.

export type SurfaceId = 'WALL' | 'ROAD' | 'DIRT' | 'GRAVEL' | 'WATER' | 'TREE';

export interface Surface {
  readonly id: SurfaceId;
  readonly label: string;
  readonly solid: boolean;
  // grip : autorité de l'impulsion sur la trajectoire (0 = aucune, 1 = kart).
  readonly grip: number;
  // drag : décélération multiplicative par tour (frein moteur + surface).
  readonly drag: number;
  readonly color: string;
  readonly dot: string;
}
