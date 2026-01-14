using UnityEngine;
using UnityEngine.Networking;
using System.Collections;
using System.Collections.Generic;
using System.Text;

public class APIHandler : MonoBehaviour
{
    private string baseUrl = "https://your-api-url.com/api"; // Replace with your store URL

    public delegate void OnProductsLoaded(List<Product> products);
    public static event OnProductsLoaded ProductsLoaded;

    public void FetchProducts()
    {
        StartCoroutine(GetRequest(baseUrl + "/products", (json) => {
            ProductList list = JsonUtility.FromJson<ProductList>("{\"products\":" + json + "}");
            ProductsLoaded?.Invoke(list.products);
        }));
    }

    public void SyncCart(CartData cart)
    {
        string json = JsonUtility.ToJson(cart);
        StartCoroutine(PostRequest(baseUrl + "/cart", json));
    }

    public void Checkout(CartData cart)
    {
        string json = JsonUtility.ToJson(cart);
        StartCoroutine(PostRequest(baseUrl + "/checkout", json, (response) => {
            Debug.Log("Checkout Successful: " + response);
            // Handle success (e.g., clear cart and show message)
        }));
    }

    IEnumerator GetRequest(string uri, System.Action<string> callback)
    {
        using (UnityWebRequest webRequest = UnityWebRequest.Get(uri))
        {
            yield return webRequest.SendWebRequest();

            if (webRequest.result == UnityWebRequest.Result.Success)
            {
                callback?.Invoke(webRequest.downloadHandler.text);
            }
            else
            {
                Debug.LogError("Error: " + webRequest.error);
            }
        }
    }

    IEnumerator PostRequest(string uri, string json, System.Action<string> callback = null)
    {
        var request = new UnityWebRequest(uri, "POST");
        byte[] bodyRaw = Encoding.UTF8.GetBytes(json);
        request.uploadHandler = (UploadHandler)new UploadHandlerRaw(bodyRaw);
        request.downloadHandler = (DownloadHandler)new DownloadHandlerBuffer();
        request.SetRequestHeader("Content-Type", "application/json");

        yield return request.SendWebRequest();

        if (request.result == UnityWebRequest.Result.Success)
        {
            callback?.Invoke(request.downloadHandler.text);
        }
        else
        {
            Debug.LogError("POST Error: " + request.error);
        }
    }
}
