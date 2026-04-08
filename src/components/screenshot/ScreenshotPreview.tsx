import { Loader2 } from "lucide-react";

interface Props {
  imageSrc: string;
  onExtract: () => void;
  onBack: () => void;
  loading: boolean;
}

const ScreenshotPreview = ({ imageSrc, onExtract, onBack, loading }: Props) => {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="border border-[#C9A84C] rounded-lg overflow-hidden max-h-[300px]">
        <img
          src={imageSrc}
          alt="Captured screenshot"
          className="max-h-[300px] object-contain"
        />
      </div>

      <button
        onClick={onExtract}
        disabled={loading}
        className="w-full py-2 bg-[#C9A84C] text-background text-sm tracking-wider font-mono rounded flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Analysing screenshot...
          </>
        ) : (
          "Extract Data"
        )}
      </button>

      {!loading && (
        <button
          onClick={onBack}
          className="text-[#C9A84C] text-xs tracking-wider font-mono underline"
        >
          Choose Different Image
        </button>
      )}
    </div>
  );
};

export default ScreenshotPreview;
