import Loader from "@/components/kokonutui/loader";

export default function AppLoading() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Loader title="Loading…" />
    </div>
  );
}
