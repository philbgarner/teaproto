export interface Tea {
  id: string;
  name: string;
  recipe: Recipe;
  temperature: number;
  ruined: boolean;
}

export interface Recipe {
  id: string;
  name: string;
  timeToBrew: number;
  idealTemperatureRange: [number, number];
}

export const RECIPES: Recipe[] = [
  { id: "green", name: "Green Tea", timeToBrew: 15, idealTemperatureRange: [60, 75] },
  { id: "black", name: "Black Tea", timeToBrew: 20, idealTemperatureRange: [85, 100] },
  { id: "oolong", name: "Oolong Tea", timeToBrew: 18, idealTemperatureRange: [70, 85] },
  { id: "herbal", name: "Herbal Brew", timeToBrew: 25, idealTemperatureRange: [65, 80] },
];
