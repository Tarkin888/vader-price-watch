import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import LotFormModal from "@/components/LotFormModal";

interface Props {
  onAdded: () => void;
}

const AddLotModal = ({ onAdded }: Props) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="text-xs tracking-wider border-border hover:border-primary hover:text-primary"
        onClick={() => setOpen(true)}
      >
        <Plus className="w-3 h-3 mr-1" /> ADD LOT
      </Button>
      <LotFormModal open={open} onOpenChange={setOpen} onSaved={onAdded} />
    </>
  );
};

export default AddLotModal;
