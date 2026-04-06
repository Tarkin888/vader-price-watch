import { useState, useRef, useCallback } from "react";
import { Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminWrite } from "@/lib/admin-write";
import { toast } from "sonner";

interface Props {
  imageUrl: string;
  itemId: string;
  field: "front_image_url" | "back_image_url";
  onUpdated: () => void;
}

const ImageDropCell = ({ imageUrl, itemId, field, onUpdated }: Props) => {
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadAndSave = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are supported");
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const { error } = await supabase
          .from("collection")
          .update({ [field]: dataUrl } as any)
          .eq("id", itemId);
        if (error) throw error;
        toast.success("Image saved");
        onUpdated();
      };
      reader.readAsDataURL(file);
    } catch (e: any) {
      toast.error("Failed to save image: " + e.message);
    }
  }, [itemId, field, onUpdated]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadAndSave(file);
  }, [uploadAndSave]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from("collection")
        .update({ [field]: "" } as any)
        .eq("id", itemId);
      if (error) throw error;
      toast.success("Image removed");
      onUpdated();
    } catch (err: any) {
      toast.error("Failed to remove image: " + err.message);
    }
  };

  const hasImage = !!imageUrl;

  return (
    <>
      <div
        className={`relative w-16 h-24 border rounded-sm flex items-center justify-center cursor-pointer overflow-hidden transition-colors ${
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
                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </>
        ) : (
          <Plus className="w-4 h-4 text-muted-foreground" />
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadAndSave(file);
            e.target.value = "";
          }}
        />
      </div>

      {/* Lightbox overlay */}
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

export default ImageDropCell;
