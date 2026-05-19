import React, { useState } from 'react';
import Button from '../ui/buttom';
import { formatCurrency } from '../../utils/format';

interface Props {
  title: string;
  imageUrl: string;
  price: number;
  onRemoveItem: () => void;
}

const RestuarantAddonItem: React.FC<Props> = ({
  title,
  imageUrl,
  price,
  onRemoveItem,
}) => {
  const [quantity, setQuantity] = useState<number>(1);

  return (
    <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all duration-200 cursor-pointer">
      <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-50 flex-shrink-0">
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-base font-semibold text-gray-800 truncate">
          {title}
        </h4>
        <p className="text-lg font-bold text-blue-600">{formatCurrency(price)}</p>
      </div>
      <div className="flex items-center">
        <Button
          onClick={() => {
            if (quantity > 1) {
              onRemoveItem();
            }
            setQuantity(quantity - 1);
          }}
        >
          -
        </Button>
        <span className="mx-2 text-gray-800 font-semibold">{quantity}</span>
        <Button onClick={() => setQuantity(quantity + 1)}>+</Button>
      </div>
    </div>
  );
};

export default RestuarantAddonItem;
