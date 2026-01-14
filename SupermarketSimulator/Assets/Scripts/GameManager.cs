using UnityEngine;
using System.Collections.Generic;

public class GameManager : MonoBehaviour
{
    public APIHandler api;
    public ShelfPopulator shelfPopulator;

    void Start()
    {
        // 1. Fetch products from API
        api.FetchProducts();
    }

    private void OnEnable()
    {
        APIHandler.ProductsLoaded += OnProductsLoaded;
    }

    private void OnDisable()
    {
        APIHandler.ProductsLoaded -= OnProductsLoaded;
    }

    private void OnProductsLoaded(List<Product> products)
    {
        // 2. Populate the shelves with real data
        if (shelfPopulator != null)
        {
            shelfPopulator.PopulateShelves(products);
        }
    }
}
