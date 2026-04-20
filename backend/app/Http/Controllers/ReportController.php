<?php

namespace App\Http\Controllers;

use App\Models\Report;
use App\Models\Transaction;
use App\Models\Settlement;
use App\Models\Partner;
use App\Models\Agent;
use App\Models\Merchant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use PDF;

class ReportController extends Controller
{
    public function index(Request $request)
    {
        $reports = Report::where('user_id', Auth::id())
            ->orderBy('created_at', 'desc')
            ->paginate(10);

        return response()->json([
            'success' => true,
            'data' => $reports
        ]);
    }

    public function generate(Request $request)
    {
        $request->validate([
            'type' => 'required|string',
            'parameters' => 'required|array',
            'format' => 'required|in:PDF,CSV,XLSX,JSON',
        ]);

        // Create report record
        $report = Report::create([
            'user_id' => Auth::id(),
            'type' => $request->type,
            'parameters' => $request->parameters,
            'format' => $request->format,
            'status' => 'pending',
        ]);

        // Generate the report
        $this->generateReportFile($report);

        return response()->json([
            'success' => true,
            'message' => 'Report generated successfully',
            'data' => $report
        ]);
    }

    private function generateReportFile(Report $report)
    {
        // Mock data based on type
        $data = $this->getReportData($report->type, $report->parameters);

        $fileName = 'report_' . $report->id . '_' . time() . '.' . strtolower($report->format);
        $path = 'reports/' . $fileName;

        if ($report->format === 'JSON') {
            Storage::put($path, json_encode($data, JSON_PRETTY_PRINT));
        } elseif ($report->format === 'CSV') {
            $csv = $this->arrayToCsv($data);
            Storage::put($path, $csv);
        } elseif ($report->format === 'PDF') {
            $html = $this->generateHtmlReport($report->type, $data, $report->parameters);
            $pdf = PDF::loadHTML($html);
            Storage::put($path, $pdf->output());
        } else {
            // For XLSX, would need additional libraries, for now just JSON
            Storage::put($path, json_encode($data, JSON_PRETTY_PRINT));
        }

        $report->update([
            'file_path' => $path,
            'status' => 'completed',
        ]);
    }

    private function getReportData($type, $parameters)
    {
        // Build base query with date filtering
        $query = $this->buildBaseQuery($type, $parameters);

        // Apply additional filters
        $this->applyFilters($query, $parameters);

        switch ($type) {
            case 'transactions':
                return $query->select([
                    'id',
                    'txn_id',
                    'amount',
                    'currency',
                    'status',
                    // 'channel_type',
                    'provider_alias',
                    'created_at',
                    DB::raw('JSON_EXTRACT(fee_breakdown, "$.gateway_fee") as gateway_fee'),
                    DB::raw('JSON_EXTRACT(fee_breakdown, "$.processing_fee") as processing_fee')
                ])->get()->toArray();

            case 'settlements':
                return $query->select([
                    'id',
                    'settlement_id',
                    'total_amount',
                    'fee_amount',
                    'status',
                    'partner_id',
                    'merchant_id',
                    'processed_at',
                    'created_at'
                ])->get()->toArray();

            case 'fees':
                return $query->select([
                    'id',
                    'txn_id',
                    'amount',
                    DB::raw('JSON_EXTRACT(fee_breakdown, "$.gateway_fee") as gateway_fee'),
                    DB::raw('JSON_EXTRACT(fee_breakdown, "$.processing_fee") as processing_fee'),
                    DB::raw('JSON_EXTRACT(fee_breakdown, "$.total_fee") as total_fee'),
                    'currency',
                    'status',
                    'created_at'
                ])->get()->toArray();

            case 'partners':
                return Partner::select([
                    'id',
                    'partner_id',
                    'name',
                    'status',
                    'default_currency',
                    'created_at'
                ])->get()->toArray();

            case 'agents':
                return Agent::select([
                    'id',
                    'agent_id',
                    'name',
                    'partner_id',
                    'status',
                    'created_at'
                ])->get()->toArray();

            case 'merchants':
                return Merchant::select([
                    'id',
                    'merchant_id',
                    'name',
                    'agent_id',
                    'partner_id',
                    'status',
                    'created_at'
                ])->get()->toArray();

            case 'customers':
                // This would need a customers table, for now return empty
                return [];

            case 'commission':
                // This would need commission tracking, for now return empty
                return [];

            case 'providers':
                // This would need provider performance data, for now return empty
                return [];

            case 'compliance':
                // This would need compliance/KYC data, for now return empty
                return [];

            case 'reconciliation':
                // This would need reconciliation data, for now return empty
                return [];

            default:
                return [];
        }
    }

    private function buildBaseQuery($type, $parameters)
    {
        $query = null;

        switch ($type) {
            case 'transactions':
            case 'fees':
                $query = Transaction::query();
                break;
            case 'settlements':
                $query = Settlement::query();
                break;
            default:
                return collect(); // Return empty collection for types that don't need date filtering
        }

        // Apply date range filter
        if (isset($parameters['dateRange'])) {
            $query = $this->applyDateRange($query, $parameters['dateRange'], $parameters);
        }
        if (!empty($parameters['txn_ids'])) {
            $query->whereIn('txn_id', $parameters['txn_ids']);
        }
        return $query;
    }

    private function applyDateRange($query, $dateRange, $parameters)
    {
        $now = Carbon::now();

        switch ($dateRange) {
            case '1d':
                return $query->whereDate('created_at', $now->toDateString());
            case '7d':
                return $query->where('created_at', '>=', $now->subDays(7));
            case '30d':
                return $query->where('created_at', '>=', $now->subDays(30));
            case '90d':
                return $query->where('created_at', '>=', $now->subDays(90));
            case '1y':
                return $query->where('created_at', '>=', $now->subYear());
            case 'custom':
                if (isset($parameters['startDate']) && isset($parameters['endDate'])) {
                    return $query->whereBetween('created_at', [
                        Carbon::parse($parameters['startDate'])->startOfDay(),
                        Carbon::parse($parameters['endDate'])->endOfDay()
                    ]);
                }
                break;
        }

        return $query;
    }

    private function applyFilters($query, $parameters)
    {
        // Apply currency filter
        if (isset($parameters['currency']) && $parameters['currency'] !== 'all') {
            $query->where('currency', $parameters['currency']);
        }

        // Apply status filter if provided
        if (isset($parameters['status'])) {
            $query->where('status', $parameters['status']);
        }

        // Apply user role-based filtering
        $user = Auth::user();
        if ($user) {
            $this->applyRoleBasedFilters($query, $user);
        }
    }

    private function applyRoleBasedFilters($query, $user)
    {
        $model = $query->getModel();

        if ($model instanceof Transaction) {
            // For transactions, filter based on merchant -> agent -> partner hierarchy
            switch ($user->role) {
                case 'PARTNER':
                    $query->whereHas('merchant.agent', function ($q) use ($user) {
                        $q->where('partner_id', $user->partner_id);
                    });
                    break;
                case 'AGENT':
                    $query->whereHas('merchant', function ($q) use ($user) {
                        $q->where('agent_id', $user->agent_id);
                    });
                    break;
                case 'MERCHANT':
                    $query->where('merchant_id', $user->merchant_id ?? $user->id);
                    break;
            }
        } elseif ($model instanceof Settlement) {
            // For settlements, filter based on partner/merchant hierarchy
            switch ($user->role) {
                case 'PARTNER':
                    $query->where('partner_id', $user->partner_id);
                    break;
                case 'AGENT':
                    // Agents see settlements for merchants under them
                    $query->whereHas('merchant', function ($q) use ($user) {
                        $q->where('agent_id', $user->agent_id);
                    });
                    break;
                case 'MERCHANT':
                    $query->where('merchant_id', $user->merchant_id ?? $user->id);
                    break;
            }
        }
        // For other models (partners, agents, merchants), SUPER_ADMIN sees all, others see none
        elseif (!in_array($user->role, ['SUPER_ADMIN'])) {
            // Return empty result for non-admin users trying to access these reports
            $query->whereRaw('1 = 0');
        }
    }

    private function arrayToCsv($data)
    {
        if (empty($data)) return '';
        $csv = '';
        $headers = array_keys($data[0]);
        $csv .= implode(',', $headers) . "\n";
        foreach ($data as $row) {
            $csv .= implode(',', array_values($row)) . "\n";
        }
        return $csv;
    }

    private function generateHtmlReport($type, $data, $parameters)
    {
        $title = ucfirst($type) . ' Report';
        $generatedAt = now()->format('Y-m-d H:i:s');

        $html = '
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>' . $title . '</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
                .header { margin-bottom: 30px; }
                .metadata { background: #f5f5f5; padding: 10px; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; font-weight: bold; }
                tr:nth-child(even) { background-color: #f9f9f9; }
                .summary { margin-top: 20px; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>' . $title . '</h1>
                <div class="metadata">
                    <p><strong>Generated At:</strong> ' . $generatedAt . '</p>
                    <p><strong>Report Type:</strong> ' . $type . '</p>
                    <p><strong>Total Records:</strong> ' . count($data) . '</p>
                </div>
            </div>
        ';

        if (!empty($data)) {
            $html .= '<table>';
            // Table headers
            $html .= '<thead><tr>';
            foreach (array_keys($data[0]) as $header) {
                $html .= '<th>' . ucfirst($header) . '</th>';
            }
            $html .= '</tr></thead>';

            // Table body
            $html .= '<tbody>';
            foreach ($data as $row) {
                $html .= '<tr>';
                foreach ($row as $value) {
                    $html .= '<td>' . htmlspecialchars($value) . '</td>';
                }
                $html .= '</tr>';
            }
            $html .= '</tbody></table>';
        } else {
            $html .= '<p>No data available for this report.</p>';
        }

        $html .= '</body></html>';

        return $html;
    }

    public function download($id)
    {
        $report = Report::where('user_id', Auth::id())->findOrFail($id);

        if (!$report->file_path || !Storage::exists($report->file_path)) {
            return response()->json(['error' => 'File not found'], 404);
        }

        return Storage::download($report->file_path);
    }

    public function delete($id)
    {
        $report = Report::where('user_id', Auth::id())->findOrFail($id);

        if ($report->file_path) {
            Storage::delete($report->file_path);
        }

        $report->delete();

        return response()->json([
            'success' => true,
            'message' => 'Report deleted successfully'
        ]);
    }

}
