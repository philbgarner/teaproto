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
  ingredientId: string | null;
  ingredientName: string | null;
  countersEffect: "bleeding" | "freezing" | "poisoned" | null;
}

export const RECIPES: Recipe[] = [
  {
    id: "iced-tea",
    name: "Iced Tea",
    timeToBrew: 20,
    idealTemperatureRange: [85, 100],
    ingredientId: "ice-leaf",
    ingredientName: "Ice Leaf",
    countersEffect: "bleeding",
  },
  {
    id: "spicy-tea",
    name: "Spicy Tea",
    timeToBrew: 18,
    idealTemperatureRange: [70, 85],
    ingredientId: "hot-pepper",
    ingredientName: "Hot Pepper",
    countersEffect: "poisoned",
  },
  {
    id: "green-tea",
    name: "Green Tea",
    timeToBrew: 25,
    idealTemperatureRange: [65, 80],
    ingredientId: "wild-herbs",
    ingredientName: "Wild Herbs",
    countersEffect: "freezing",
  },
];
