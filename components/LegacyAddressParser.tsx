import React from 'react';

// Define the shape of the user address
interface Address {
    zipCode?: string;
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
}

// Define the props for the LegacyAddressParser component
interface LegacyAddressParserProps {
    address: Address | undefined;
}

// Helper function to parse address if number is missing
const parseAddress = (address: Address | undefined) => {
    let street = address?.street || '';
    let number = address?.number || '';

    // If number is empty but street ends with digits, try to extract
    if (!number && /\d+$/.test(street)) {
        const match = street.match(/^(.*?)(\d+)$/);
        if (match) {
            street = match[1].trim();
            number = match[2];
        }
    }
    return { street, number };
};

const LegacyAddressParser: React.FC<LegacyAddressParserProps> = ({ address }) => {
    const { street, number } = parseAddress(address);

    return (
        <>
            <div className="grid grid-cols-12 gap-4 mb-4">
                <div className="col-span-4 space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase transition-colors">CEP</label>
                    <input name="zipCode" type="text" defaultValue={address?.zipCode || ''} className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none transition-colors" />
                </div>
                <div className="col-span-6 space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase transition-colors">Cidade</label>
                    <input name="city" type="text" defaultValue={address?.city || ''} className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none transition-colors" />
                </div>
                <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase transition-colors">UF</label>
                    <input name="state" type="text" defaultValue={address?.state || ''} className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none transition-colors" maxLength={2} />
                </div>
            </div>

            <div className="grid grid-cols-12 gap-4 mb-4">
                <div className="col-span-9 space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase transition-colors">Logradouro</label>
                    <input name="street" type="text" defaultValue={street} className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none transition-colors" />
                </div>
                <div className="col-span-3 space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase transition-colors">Número</label>
                    <input name="number" type="text" defaultValue={number} className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none transition-colors" />
                </div>
            </div>

            <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase transition-colors">Bairro</label>
                <input name="neighborhood" type="text" defaultValue={address?.neighborhood || ''} className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none transition-colors" />
            </div>
        </>
    );
};

export default LegacyAddressParser;
