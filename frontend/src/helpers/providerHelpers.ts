
//TODO:: Gateway data
const gatewayConfigs = {
  PG0001: {
    fields: [
      { name: 'api_key', label: 'API Key', type: 'text', required: true, placeholder: 'Enter API Key' },
      // { name: 'endpoint', label: 'Endpoint URL', type: 'url', required: true, placeholder: 'Enter Endpoint URL' },
      { name: 'environment', label: 'Environment', type: 'select', required: true, options: ['development', 'production'] }

    ],
    description: 'Payment gateway configuration'
  },
  PG0002: {
    fields: [
      { name: 'api_key', label: 'API Key', type: 'text', required: true, placeholder: 'Enter API Key' },
      { name: 'api_secret', label: 'API Secret', type: 'password', required: true, placeholder: 'Enter API Secret' },
      { name: 'merchant_code', label: 'Merchant Code', type: 'text', required: true, placeholder: 'Enter Merchant Code' },
      { name: 'callback_url', label: 'Callback URL', type: 'url', required: false, placeholder: 'https://your-domain.com/callback' },
      { name: 'return_url', label: 'Return URL', type: 'url', required: false, placeholder: 'https://your-domain.com/return' },
      { name: 'environment', label: 'Environment', type: 'select', required: true, options: ['development', 'production'] }
    ],
    description: 'Payment gateway configuration'
  },
  PG0003: {
    fields: [
      { name: 'private_key', label: 'Private Key', type: 'password', required: true, placeholder: 'Enter Private Key' },
      { name: 'min', label: 'Min Amount', type: 'number', required: true, placeholder: 'Enter Min Amount' },
      { name: 'max', label: 'Max Amount', type: 'number', required: true, placeholder: 'Enter Max Amount' },
      { name: 'environment', label: 'Environment', type: 'select', required: true, options: ['development', 'production'] }
    ],
    description: 'Payment gateway configuration'
  },
  PG0004: {
    fields: [
      { name: 'details', label: 'Details', type: 'textarea', required: true, placeholder: 'Enter Offline Gateway Details' },
    ],
    description: 'Payment gateway configuration'
  },
  PG0005: {
    fields: [
      { name: 'app_ID', label: 'App Id', type: 'text', required: true, placeholder: 'Enter App Id' },
      { name: 'app_secret', label: 'App Secret', type: 'text', required: true, placeholder: 'Enter App Secret' },
      { name: 'network', label: 'Network', type: 'text', required: true, placeholder: 'Enter crypto network' },
      { name: 'address', label: 'Wallet address', type: 'text', required: true, placeholder: 'Enter Wallet Address' },
      { name: 'environment', label: 'Environment', type: 'select', required: true, options: ['development', 'production'] }
    ],
    description: 'Payment gateway configuration'
  },
  PG0006: {
    fields: [
      { name: 'account_id', label: 'Account Id', type: 'text', required: true, placeholder: 'Enter Account Id' },
      { name: 'merchant_id', label: 'Merchant Id', type: 'text', required: true, placeholder: 'Enter Merchant Id' },
      { name: 'project_id', label: 'Project Id', type: 'text', required: true, placeholder: 'Enter Project Id' },
      { name: 'private_key', label: 'Private key', type: 'text', required: true, placeholder: 'Enter Private key' },
      { name: 'public_key', label: 'Public Key', type: 'text', required: true, placeholder: 'Enter Public key'}
    ],
    description: 'Payment gateway configuration'
  },
};

//TODO::function form fields
export const getGatewayFields = (gateway: string) => {
  return gatewayConfigs[gateway as keyof typeof gatewayConfigs] || { fields: [], description: 'No specific configuration required' };
};

// Legacy function for payout inputs (keeping for backward compatibility)
export const getProviderInputs = (providerName: string, type: string, form: any,) => {
  switch (providerName) {
    case "PAYCOMBAT":
      return [
        { label: "Currency", name: "currency", type: "select", options: form.currencies || [], placeholder: "Select Currency" },
        { label: "Amount", name: "amount", type: "number", placeholder: "Enter payout amount" },
        { label: "Payout Method Name", name: "method", type: "text", placeholder: "Enter payout method name" },
        { label: "Account Number", name: "account_number", type: "text", placeholder: "Enter Account Number" },
        { label: "Country", name: "country", type: "text", placeholder: "Enter Country", },
        { label: "Comment (Optional)", name: "comment", type: "textarea", placeholder: "Add any note..." },
      ];
    case "KWIKWIRE":
      return [
        { label: "Currency", name: "currency", type: "select", options: form.currencies || [], placeholder: "Select Currency" },
        { label: "Amount", name: "amount", type: "number", placeholder: "Enter amount" },
        { label: "Country", name: "country", type: "text", placeholder: "Enter Your Country" },
        { label: "Phone Number", name: "phone", type: "number", placeholder: "Enter Your Phone Number" },
        { label: "Holder Name", name: "holder_name", type: "text", placeholder: "Enter Account Holder Name" },
        { label: "Account Number", name: "account_number", type: "number", placeholder: "Enter Account Number" },
        { label: "Routing Number", name: "routing_number", type: "number", placeholder: "Enter Routing Number" },
        { label: "Address (Optional)", name: "address", type: "text", placeholder: "Enter Your Address" },
        { label: "City (Optional)", name: "city", type: "text", placeholder: "Enter Your City" },
        { label: "Zip Code (Optional)", name: "zip", type: "text", placeholder: "Enter Your Zip Code" },
        { label: "Additional Information (Optional)", name: "additional_information", type: "textarea", placeholder: "Add any information..." },
      ];
    case "OFFLINE": {
      const baseFields = [
        { label: "Currency", name: "currency", type: "select", options: form.currencies || [], placeholder: "Select Currency" },
        { label: "Amount", name: "amount", type: "number", placeholder: "Enter amount" },
        { label: "Details", name: "details", type: "textarea", placeholder: "Add payout details..." },
      ];

      if (type === "PAYIN") {
        baseFields.unshift({
          label: "Transaction ID",
          name: "txn_id",
          type: "text",
          placeholder: "Enter Transaction ID",
        });
      }

      return baseFields;
    }
    default:
      return [];
  }
};
