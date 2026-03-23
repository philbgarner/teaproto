/**
 * Overlay menu for selecting a recipe to brew at a stove. Displayed centred
 * over the 3D viewport when the player interacts with a stove.
 *
 * All state mutations (ingredient deduction, stove state update, message) are
 * delegated to the `onSelectRecipe` callback so this component stays pure
 * display + routing.
 *
 * @param {{
 *   recipes: object[],
 *   ingredients: { [id: string]: number },
 *   onSelectRecipe: (recipe: object) => void,
 *   onCancel: () => void,
 *   showMsg: (text: string) => void,
 * }} props
 */
export function RecipeMenu({ recipes, ingredients, onSelectRecipe, onCancel, showMsg }) {
  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        background: "rgba(0,0,0,0.93)",
        border: "1px solid #666",
        padding: 20,
        borderRadius: 6,
        minWidth: 280,
        color: "#eee",
        fontFamily: "monospace",
      }}
    >
      <div
        style={{
          fontWeight: "bold",
          marginBottom: 12,
          color: "#fa0",
          fontSize: 15,
        }}
      >
        Select Recipe
      </div>
      {recipes.map((recipe, i) => {
        const locked =
          recipe.ingredientId &&
          (ingredients[recipe.ingredientId] ?? 0) < 1;
        const have = recipe.ingredientId
          ? (ingredients[recipe.ingredientId] ?? 0)
          : null;
        return (
          <div
            key={recipe.id}
            onClick={() => {
              if (locked) {
                showMsg(`You need ${recipe.ingredientName} to brew ${recipe.name}!`);
                return;
              }
              onSelectRecipe(recipe);
            }}
            style={{
              padding: "6px 8px",
              cursor: locked ? "not-allowed" : "pointer",
              borderRadius: 3,
              marginBottom: 4,
              background: locked
                ? "rgba(80,0,0,0.3)"
                : "rgba(255,255,255,0.05)",
              fontSize: 13,
              opacity: locked ? 0.6 : 1,
            }}
          >
            <span style={{ color: locked ? "#955" : "#fa0" }}>
              [{i + 1}]
            </span>{" "}
            {recipe.name}{" "}
            <span style={{ color: "#777" }}>
              ({recipe.timeToBrew} steps,{" "}
              {recipe.idealTemperatureRange[0]}–
              {recipe.idealTemperatureRange[1]}°)
            </span>
            {recipe.ingredientId && (
              <span
                style={{
                  color: locked ? "#f55" : "#5d5",
                  fontSize: 11,
                  marginLeft: 6,
                }}
              >
                [{recipe.ingredientName}: {have}]
              </span>
            )}
          </div>
        );
      })}
      <div style={{ marginTop: 10, color: "#555", fontSize: 11 }}>
        Press number to select · I / Esc to cancel
      </div>
    </div>
  );
}
