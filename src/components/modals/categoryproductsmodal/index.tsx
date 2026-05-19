import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { ProductItem } from '../../../main/api/products';
import { formatCurrency } from '../../../utils/format';

interface CategoryProductsModalProps {
    category: string;
    onClose: () => void;
    onProductSelect: (product: ProductItem) => void;
    products: ProductItem[];
}

const CategoryProductsModal: React.FC<CategoryProductsModalProps> = ({
    category,
    onClose,
    onProductSelect,
    products,
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredProducts, setFilteredProducts] = useState<ProductItem[]>([]);

    useEffect(() => {
        // Filter products by category and search query
        const filtered = products.filter((product) => {
            const matchesCategory = product.item_group === category;
            const matchesSearch =
                searchQuery === '' ||
                product.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                product.item_code.toLowerCase().includes(searchQuery.toLowerCase());

            return matchesCategory && matchesSearch;
        });
        setFilteredProducts(filtered);
    }, [category, products, searchQuery]);

    // Handle Escape key
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">{category}</h2>
                        <p className="text-sm text-gray-500">{filteredProducts.length} Products</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                    >
                        <X className="w-6 h-6 text-gray-500" />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="p-4 border-b border-gray-100">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search in this category..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Product Grid */}
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50/30">
                    {filteredProducts.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {filteredProducts.map((product) => (
                                <button
                                    key={product.item_code}
                                    onClick={() => onProductSelect(product)}
                                    className="flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 hover:ring-2 hover:ring-blue-500/20 transition-all duration-200 overflow-hidden group text-left"
                                >
                                    <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
                                        {product.image ? (
                                            <img
                                                src={product.image}
                                                alt={product.item_name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                                        product.item_name,
                                                    )}&background=random&size=200`;
                                                }}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400 text-3xl font-bold">
                                                {product.item_name.charAt(0)}
                                            </div>
                                        )}
                                        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-bold text-gray-700 shadow-sm border border-gray-100">
                                            {product.stock_uom}
                                        </div>
                                    </div>

                                    <div className="p-3 flex flex-col flex-1 gap-1">
                                        <h3 className="font-semibold text-gray-800 line-clamp-2 leading-tight group-hover:text-blue-600 transition-colors">
                                            {product.item_name}
                                        </h3>
                                        <div className="mt-auto pt-2 flex items-center justify-between">
                                            <span className="text-lg font-bold text-blue-600">
                                                {formatCurrency(product.standard_rate || 0)}
                                            </span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
                            <Search className="w-12 h-12 mb-3 opacity-20" />
                            <p className="text-lg font-medium">No products found</p>
                            <p className="text-sm">Try searching for something else</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CategoryProductsModal;
