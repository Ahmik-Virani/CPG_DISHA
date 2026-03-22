export default function PaymentRequestDetails({ paymentRequest, formatPaymentType }) {
  const oneTimeEntries =
    Array.isArray(paymentRequest.entries) && paymentRequest.entries.length
      ? paymentRequest.entries
      : [{ rollNo: paymentRequest.rollNo, amount: paymentRequest.amount }];

  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <h3 className="text-sm font-semibold text-gray-800">Request Details</h3>
      <div className="mt-3 grid gap-2 text-sm text-gray-700 md:grid-cols-2">
        <p>
          <span className="font-medium">Request Type:</span> {formatPaymentType(paymentRequest.type)}
        </p>
        <p>
          <span className="font-medium">Bank:</span>{" "}
          {paymentRequest.bank || (Array.isArray(paymentRequest.banks) && paymentRequest.banks.length ? paymentRequest.banks[0] : "-")}
        </p>

        {paymentRequest.type === "one_time" ? (
          <>
            <p>
              <span className="font-medium">Time To Live:</span>{" "}
              {paymentRequest.timeToLive ? new Date(paymentRequest.timeToLive).toLocaleString() : "-"}
            </p>
            <p>
              <span className="font-medium">Rows:</span> {oneTimeEntries.length}
            </p>
            <div className="md:col-span-2 overflow-x-auto">
              <div className="max-h-105 overflow-y-auto rounded-lg border border-gray-200 bg-white">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="border border-gray-200 px-3 py-2">S.No</th>
                      <th className="border border-gray-200 px-3 py-2">Roll No</th>
                      <th className="border border-gray-200 px-3 py-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {oneTimeEntries.map((entry, index) => (
                      <tr key={`${entry.rollNo || "row"}-${entry.amount || index}-${index}`}>
                        <td className="border border-gray-200 px-3 py-2">{index + 1}</td>
                        <td className="border border-gray-200 px-3 py-2">{entry.rollNo || "-"}</td>
                        <td className="border border-gray-200 px-3 py-2">
                          {typeof entry.amount === "number" ? `\u20B9${entry.amount}` : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}

        {paymentRequest.type === "fixed" ? (
          <>
            <p>
              <span className="font-medium">Is Amount Fixed:</span>{" "}
              {paymentRequest.isAmountFixed ? "Yes" : "No"}
            </p>
            <p>
              <span className="font-medium">Amount:</span>{" "}
              {paymentRequest.isAmountFixed && typeof paymentRequest.amount === "number"
                ? `\u20B9${paymentRequest.amount}`
                : "Variable"}
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
