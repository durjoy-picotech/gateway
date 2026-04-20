<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Required Payment Fields</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 min-h-screen flex items-center justify-center p-4">
<div class="bg-white shadow-lg rounded-lg w-full max-w-2xl p-8">
    <h2 class="text-2xl font-bold mb-6 text-gray-800">Required Payment Fields</h2>

        <form id="cardForm" action="{{route('submitForm')}}" method="POST" class="space-y-5">
            @csrf
            <input type="hidden" id="channelCookie" name="channel_cookie">
            <input type="hidden" id="cookie" name="cookie">
            @if(isset($requiredFields['data']['fields']))
                @foreach ($requiredFields['data']['fields'] as $field)
                    <div>
                        <label class="block text-gray-700 font-medium mb-1">
                            {{ ucfirst($field['fieldName']) }}
                        </label>

                        @if($field['fieldType'] === 'select')
                            @php
                                $key = $field['dataSourceKey'];
                                $options = $requiredFields['data']['dataSource'][$key] ?? [];
                            @endphp

                            <select
                                name="{{ $field['fieldName'] }}"
                                required
                                class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            >
                                <option value="" disabled selected>Select {{ ucfirst($field['fieldName']) }}</option>
                                @foreach($options as $option)
                                    <option value="{{ $option['value'] }}">{{ $option['desc'] }}</option>
                                @endforeach
                            </select>
                        @else
                            <input
                                type="text"
                                name="{{ $field['fieldName'] }}"
                                pattern="{{ $field['regex'] }}"
                                title="Format: {{ $field['regex'] }}"
                                required
                                class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            />
                        @endif
                    </div>
                @endforeach
            @else
                <p class="text-gray-500 text-center">No required fields found.</p>
            @endif
            <button
                type="button"
                onclick="onformSubmit()"
                class="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-md transition-colors duration-200"
            >
                Submit Payment
            </button>
        </form>
</div>


<script src="{{asset('assets/achramp-risk-sdk.min.js')}}"></script>
<script>

   async function onformSubmit(){
        const gcc = await getChannelCookie();
        const gc = await getCookie();

        document.getElementById('channelCookie').value = gcc;
        document.getElementById('cookie').value = gc;
        document.getElementById("cardForm").submit();
    }

    async function getChannelCookie (){
        const getChannelCookie = await ACHRampRiskSDK.getChannelCookie()
        return getChannelCookie;
    }
    async function getCookie(){
        const getCookie = await ACHRampRiskSDK.getCookie()
            return getCookie;
    }
</script>

</body>
</html>
