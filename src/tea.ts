export interface Tea {
  id: string;
  name: string;
  recipe: Recipe;
  temperature: number;
}

export interface Recipe {
  id: string;
  name: string;
  timeToBrew: number;
  idealTemperatureRange: [number, number];
}
