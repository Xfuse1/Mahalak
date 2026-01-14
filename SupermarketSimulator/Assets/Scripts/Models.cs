using System;
using System.Collections.Generic;

[Serializable]
public class Product
{
    public string id;
    public string name;
    public float price;
    public string modelType;
    public bool isHealthy; // New: Flag for health points
}

[Serializable]
public class ProductList
{
    public List<Product> products;
}

[Serializable]
public class CartItem
{
    public string productId;
    public int quantity;
}

[Serializable]
public class CartData
{
    public List<CartItem> items;
}
