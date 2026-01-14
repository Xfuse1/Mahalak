using UnityEngine;

public class PickupProduct : MonoBehaviour
{
    public Product productData;

    // Use this to initialize data from the API list later
    public void Initialize(Product data)
    {
        productData = data;
        gameObject.name = data.name;
    }
}
