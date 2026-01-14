using UnityEngine;

public class PhysicalCartProduct : MonoBehaviour
{
    public Product productData;
    private bool isInCart = false;

    private void OnTriggerEnter(Collider other)
    {
        if (other.CompareTag("CartTrigger") && !isInCart)
        {
            isInCart = true;
            CartManager.Instance.AddToCart(productData);
            SoundManager.Instance.PlayDrop();
            
            if (productData.isHealthy)
            {
                GamificationManager.Instance.AddHealthyPoints(10);
                SoundManager.Instance.PlayHealthyPoint();
            }
            
            Debug.Log($"{productData.name} dropped into cart!");
        }
    }
}
