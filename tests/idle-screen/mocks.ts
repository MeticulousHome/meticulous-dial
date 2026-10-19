export const brightnessRequests: number[] = [];
export const api = new Proxy(
  {},
  {
    get() {
      return () => {
        throw new Error('Unexpected backend call in screen fixture');
      };
    }
  }
);
export const setBrightness = async ({ brightness }: { brightness: number }) => {
  brightnessRequests.push(brightness);
};
const settings = {
  idle_screen:
    new URLSearchParams(window.location.search).get('clock') || 'analog'
};
export const useSettings = () => ({ data: settings });
export const useNetworkConfig = () => ({
  data: { status: { connected: true } },
  refetch: () => undefined
});
export const routes = { profileHome: {}, idle: {} };
