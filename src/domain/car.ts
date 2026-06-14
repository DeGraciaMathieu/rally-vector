// Caractéristiques d'une voiture (data-driven). La voiture est une DONNÉE
// (data/cars.ts) ; ici, seulement la forme lue par la physique. `gripFactor` et
// `dragFactor` multiplient le grip/drag de la surface (une voiture « terre » souffre
// moins du gravier). `livery` = simple couleur de rendu (pas d'asset).

export interface Car {
  readonly id: string;
  readonly label: string;
  readonly maxImpulse: number; // poussée max par tour (longueur de la flèche)
  readonly maxSpeed: number; // vitesse de pointe (plafond)
  readonly gripFactor: number; // multiplicateur de grip par-dessus la surface
  readonly dragFactor: number; // multiplicateur de drag par-dessus la surface
  readonly angleGripLoss: number; // perte d'adhérence en braquage à grande vitesse
  readonly livery: string; // couleur de carrosserie
}
