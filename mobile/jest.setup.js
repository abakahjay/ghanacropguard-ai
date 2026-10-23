jest.mock("expo-secure-store", () => {
  const store = {};
  return {
    getItemAsync: jest.fn(async (k) => store[k] ?? null),
    setItemAsync: jest.fn(async (k, v) => { store[k] = v; }),
    deleteItemAsync: jest.fn(async (k) => { delete store[k]; }),
  };
});
jest.mock("expo-haptics", () => ({ selectionAsync: jest.fn(async () => {}) }));
jest.mock("@react-native-community/netinfo", () => ({ addEventListener: jest.fn(() => () => {}) }));
