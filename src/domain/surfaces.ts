// Types des surfaces de sol. La TABLE des valeurs vit dans data/surfaces.ts ;
// ici on ne décrit que la forme d'une donnée de surface. L'ID est OUVERT (string) :
// ajouter un sol (ex. OIL) = une entrée de données, sans toucher au domaine.

import { ContactPolicy } from './collision';

export type SurfaceId = string;

export interface Surface {
  readonly id: SurfaceId;
  readonly label: string;
  readonly solid: boolean;
  // contact : conséquence si ce sol solide est heurté. Défaut 'fatal'.
  readonly contact?: ContactPolicy;
  // grip : autorité de l'impulsion sur la trajectoire (0 = aucune, 1 = kart).
  readonly grip: number;
  // drag : décélération multiplicative par tour (frein moteur + surface).
  readonly drag: number;
  // hazard : sol dangereux (effets visuels futurs, ex. gerbe d'eau). Cosmétique.
  readonly hazard?: boolean;
  readonly color: string;
  readonly dot: string;
}
