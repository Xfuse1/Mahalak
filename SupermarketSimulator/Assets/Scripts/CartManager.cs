using UnityEngine;
using System.Collections.Generic;
using System.Linq;

public class CartManager : MonoBehaviour
{
    public static CartManager Instance;

    public List<Product> items = new List<Product>();
    public float TotalPrice => items.Sum(i => i.price);

    private void Awake()
    {
        if (Instance == null) Instance = this;
        else Destroy(gameObject);
    }

    public void AddToCart(Product product)
    {
        items.Add(product);
        Debug.Log($"Added {product.name} to cart. Total: {TotalPrice}");
        UIManager.Instance.UpdateCartUI();
    }

    public void RemoveFromCart(Product product)
    {
        items.Remove(product);
        UIManager.Instance.UpdateCartUI();
    }

    public void ClearCart()
    {
        items.Clear();
        UIManager.Instance.UpdateCartUI();
    }

    public CartData GetCartData()
    {
        CartData data = new CartData { items = new List<CartItem>() };
        var grouped = items.GroupBy(i => i.id);
        foreach (var group in grouped)
        {
            data.items.Add(new CartItem { productId = group.Key, quantity = group.Count() });
        }
        return data;
    }
}
