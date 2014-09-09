using System;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Web;

namespace TruCode.Web.UI.Controls
{
    public class ProxyOptions
    {
        public HttpRequest OriginalRequest { get; set; }
        public string Url { get; set; }
        public string Data { get; set; }
        public string Method { get; set; }
        public string Authorization { get; set; }
        public string Accept { get; set; }
        public string ContentType { get; set; }
        public bool Ready { get; set; }

        public ProxyOptions()
        {
            Ready = true;

            try
            {
                this.OriginalRequest = HttpContext.Current.Request;
                var req = HttpContext.Current.Request;
                string urlKey = "proxyUrl";

                this.Url = req.QueryString[urlKey];
                this.Method = req.HttpMethod;
                this.ContentType = req.ContentType;

                // check for post or get data
                string qs = req.QueryString.ToString();
                StreamReader sr = new StreamReader(req.InputStream);
                string postData = sr.ReadToEnd();
                if (!string.IsNullOrWhiteSpace(postData))
                {
                    this.Data = postData;
                }
                else
                {
                    // remove URL component from query string
                    qs = qs.Replace(string.Format("&{0}={1}", urlKey, HttpUtility.UrlEncode(this.Url)), "");
                    qs = qs.Replace(string.Format("{0}={1}", urlKey, HttpUtility.UrlEncode(this.Url)), "");
                    if (qs.Length > 0 && (qs[0] == '&' || qs[0] == '?'))
                        qs = qs.Substring(1);
                    this.Data = qs;
                }

            }
            catch (Exception)
            {
                Ready = false;
            }
        }
    }

    public partial class proxy : System.Web.UI.Page
    {
        protected void Page_Load(object sender, EventArgs e)
        {
            try
            {
                bool debug = false;
                var proxyData = new ProxyOptions();

                if (proxyData.Ready)
                {
                    HttpWebRequest proxyRequest = null;

                    // Create request stub for get or post
                    switch (proxyData.Method)
                    {
                        case "POST":
                        case "PUT":
                        case "PATCH":
                        case "MERGE":
                            proxyRequest = CreatePostRequest(proxyData);
                            break;
                        default:
                            proxyRequest = CreateGetRequest(proxyData);
                            break;
                    }

                    // Shared request properties
                    if (proxyRequest != null)
                    {
                        proxyRequest.Method = proxyData.Method;
                        proxyRequest.ContentType = proxyData.ContentType;
                        proxyRequest.Accept = proxyData.Accept;
                        this.CopyHeaders(proxyRequest, proxyData.OriginalRequest);
                        ExecuteAndWriteProxyResponse(proxyRequest);
                    }
                }
                else
                {
                    throw new Exception("There was a problem parsing the proxy request options provided.");
                }
            }
            catch (ThreadAbortException)
            {
                // response.end generates this
            }
            catch (Exception ex)
            {
                // Writing a plain 500 trashes all custom messages
                Response.ClearHeaders();
                Response.ClearContent();
                Response.Status = "503 ServiceUnavailable";
                Response.StatusCode = 503;
                Response.StatusDescription = ex.Message; // writes to header
                Response.Flush();
                throw new HttpException(503, ex.Message); // writes to body
            }
        }

        private void CopyHeaders(HttpWebRequest proxyRequest, HttpRequest httpRequest)
        {
            foreach (var header in httpRequest.Headers) {
                var key = header.ToString();
                var val = httpRequest.Headers[key];
                switch (header.ToString())
                {
                    case "Accept":
                        proxyRequest.Accept = val;
                        break;
                    case "Accept-Encoding":
                        proxyRequest.Headers.Add(key, val);
                        break;
                    case "Accept-Language":
                        proxyRequest.Headers.Add(key, val);
                        break;
                    case "Authorization":
                        proxyRequest.Headers.Add(key, val);
                        break;
                    case "Content-Type":
                        proxyRequest.ContentType = val;
                        break;
                    case "From":
                        proxyRequest.Headers.Add(key, val);
                        break;
                    case "Referer":
                        proxyRequest.Referer = string.Format("{0}--{1}", val, "TEE Proxy");
                        break;
                    case "Transfer-Encoding":
                        proxyRequest.TransferEncoding = val;
                        break;
                    case "User-Agent":
                        proxyRequest.UserAgent = val;
                        break;
                    default:
                        break;
                }
            }
        }

        private void AddHeader(HttpWebRequest request, string key, string keyData)
        {
            if (!string.IsNullOrWhiteSpace(keyData))
            {
                try
                {
                    request.Headers.Add(key, keyData);
                } catch (Exception) {}
            }
        }

        private HttpWebRequest CreateGetRequest(ProxyOptions proxyData)
        {
            return (HttpWebRequest)WebRequest.Create(string.Format("{0}?{1}", proxyData.Url, proxyData.Data));
        }

        private HttpWebRequest CreatePostRequest(ProxyOptions proxyData)
        {
            var request = (HttpWebRequest)WebRequest.Create(proxyData.Url);
            request.Method = proxyData.Method; // must set this to be able to write body
            Stream reqStream = request.GetRequestStream();
            byte[] reqBytes = Encoding.UTF8.GetBytes(proxyData.Data);
            reqStream.Write(reqBytes, 0, reqBytes.Length);
            reqStream.Close();
            return request;
        }

        public static byte[] ReadFully(Stream input)
        {
            byte[] buffer = new byte[16 * 1024];
            using (MemoryStream ms = new MemoryStream())
            {
                int read;
                while ((read = input.Read(buffer, 0, buffer.Length)) > 0)
                {
                    ms.Write(buffer, 0, read);
                }
                return ms.ToArray();
            }
        }

        private void ExecuteAndWriteProxyResponse(HttpWebRequest proxyRequest)
        {
            var r = Response;

            // Clear whatever is already sent
            r.Clear();
            r.ClearContent();
            r.ClearHeaders();

            try
            {
                using (var proxyResponse = proxyRequest.GetResponse())
                {
                    Stream receiveStream = proxyResponse.GetResponseStream();

                    // Copy content
                    var fullResponse = ReadFully(receiveStream);
                    r.OutputStream.Write(fullResponse, 0, fullResponse.Length);

                    AddContentLength(proxyResponse, fullResponse.Length);

                    receiveStream.Close();
                    r.Flush();
                    r.Close();
                }
            }
            catch (WebException wex)
            {
                var httpResponse = wex.Response as HttpWebResponse;
                r.StatusCode = (int)httpResponse.StatusCode;
                StreamReader sr = new StreamReader(httpResponse.GetResponseStream());
                string wr = sr.ReadToEnd();
                r.Write(wr);
                r.End();
            }
        }

        private void AddContentLength(WebResponse proxyResponse, long length)
        {
            var r = Response;
            // Copy headers
            // IE doesnt like a missing contenth-length
            bool contentLengthFound = false;
            foreach (string header in proxyResponse.Headers)
            {
                if (string.Compare(header, "CONTENT-LENGTH", true) == 0)
                {
                    contentLengthFound = true;
                }
                r.AppendHeader(header, proxyResponse.Headers[header]);
            }

            // Manually add content-lenght header to satisfy IE
            if (!contentLengthFound)
            {
                r.AppendHeader("Content-Length", length.ToString());
            }
        }
    }
}