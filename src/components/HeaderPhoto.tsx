import { useState, useRef, useCallback } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "header-photo";

const HeaderPhoto = () => {
  const [imageUrl, setImageUrl] = useState<string>(() => localStorage.getItem(STORAGE_KEY) || "");
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const saveImage = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are supported");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      try {
        localStorage.setItem(STORAGE_KEY, dataUrl);
        setImageUrl(dataUrl);
        toast.success("Photo saved");
      } catch {
        toast.error("Image too large for local storage");
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) saveImage(file);
  }, [saveImage]);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.removeItem(STORAGE_KEY);
    setImageUrl("");
    toast.success("Photo removed");
  };

  const hasImage = !!imageUrl;

  return (
    <>
      <div
        className={`relative w-[72px] h-[108px] border rounded flex items-center justify-center cursor-pointer overflow-hidden transition-colors shrink-0 ${
          dragging
            ? "border-primary bg-primary/10"
            : hasImage
              ? "border-border"
              : "border-border/50 border-dashed hover:border-primary/50"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => hasImage ? setLightbox(true) : inputRef.current?.click()}
      >
        {hasImage ? (
          <>
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
            {hover && (
              <button
                onClick={handleDelete}
                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </>
        ) : (
          <Plus className="w-5 h-5 text-muted-foreground" />
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) saveImage(file);
            e.target.value = "";
          }}
        />
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center cursor-zoom-out"
          onClick={() => setLightbox(false)}
        >
          <button
            onClick={() => setLightbox(false)}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-card/80 text-foreground flex items-center justify-center hover:bg-card transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={imageUrl}
            alt=""
            className="max-w-[90vw] max-h-[90vh] object-contain rounded shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};

export default HeaderPhoto;
